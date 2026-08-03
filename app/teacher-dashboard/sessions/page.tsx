'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, History, Activity, Clock, Monitor, Smartphone, Search, RefreshCw, X, BookOpen, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
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
    
    // Grouping, report generation, and expansion states
    const [activeTab, setActiveTab] = useState<'all' | 'months' | 'students'>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedReportUser, setSelectedReportUser] = useState<any | null>(null);
    const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
    const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});

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
        
        let matchesDate = true;
        if (startDate) {
            const loginDate = new Date(session.login_at);
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            matchesDate = matchesDate && loginDate >= start;
        }
        if (endDate) {
            const loginDate = new Date(session.login_at);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            matchesDate = matchesDate && loginDate <= end;
        }

        const online = isOnline(session);
        if (filterOnline === 'online') return matchesSearch && matchesDate && online;
        if (filterOnline === 'offline') return matchesSearch && matchesDate && !online;
        return matchesSearch && matchesDate;
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

    // Deterministic date formatting helpers to prevent Next.js hydration issues
    const MONTH_NAMES = useMemo(() => [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ], []);
    
    const getMonthYearString = (dateString: string) => {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return 'Unknown Month';
        return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    };

    const formatDateTime = (dateString: string) => {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    // Month-wise record deletion
    const handleDeleteMonth = async (monthName: string, sessionsInMonth: SessionLog[]) => {
        const total = sessionsInMonth.length;
        if (!confirm(`Are you sure you want to delete all ${total} login records for ${monthName}? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const ids = sessionsInMonth.map(s => s.id);
            if (ids.length === 0) return;
            
            const { error } = await supabaseAuth
                .from('user_sessions')
                .delete()
                .in('id', ids);
                
            if (error) throw error;
            
            showToast(`Deleted ${total} login records for ${monthName} successfully.`, 'success');
            await fetchSessions(true);
        } catch (err: any) {
            console.error('Error deleting month records:', err);
            showToast(err.message || 'Failed to delete records', 'error');
        }
    };

    const toggleMonthExpand = (monthKey: string) => {
        setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
    };

    const toggleStudentExpand = (userId: string) => {
        setExpandedStudents(prev => ({ ...prev, [userId]: !prev[userId] }));
    };

    // Month-wise grouping calculations
    const monthGroupedData = useMemo(() => {
        const groups: Record<string, { monthKey: string; totalSessions: number; uniqueUsers: Set<string>; totalDuration: number; sessions: SessionLog[] }> = {};
        
        filteredSessions.forEach(session => {
            const monthName = getMonthYearString(session.login_at);
            
            if (!groups[monthName]) {
                groups[monthName] = {
                    monthKey: monthName,
                    totalSessions: 0,
                    uniqueUsers: new Set(),
                    totalDuration: 0,
                    sessions: []
                };
            }
            
            // Calculate stay duration
            let dur = session.duration_seconds;
            if (!dur) {
                const login = new Date(session.login_at).getTime();
                const lastActive = new Date(session.last_activity_at).getTime();
                dur = Math.max(0, Math.floor((lastActive - login) / 1000));
            }
            
            groups[monthName].totalSessions += 1;
            groups[monthName].uniqueUsers.add(session.user_id);
            groups[monthName].totalDuration += dur;
            groups[monthName].sessions.push(session);
        });
        
        return Object.values(groups).sort((a, b) => {
            return new Date(b.sessions[0].login_at).getTime() - new Date(a.sessions[0].login_at).getTime();
        });
    }, [filteredSessions, MONTH_NAMES]);

    // Student-grouped calculations
    const studentGroupedData = useMemo(() => {
        const groups: Record<string, { 
            userId: string; 
            name: string; 
            email: string; 
            role: string; 
            totalSessions: number; 
            totalDuration: number; 
            lastActive: string; 
            sessions: SessionLog[] 
        }> = {};
        
        filteredSessions.forEach(session => {
            const role = session.users?.role || 'student';
            // Only group Student logs
            if (role.toLowerCase() !== 'student') return;

            const userId = session.user_id;
            const name = session.users?.name || 'Unknown Student';
            const email = session.users?.email || '';
            
            if (!groups[userId]) {
                groups[userId] = {
                    userId,
                    name,
                    email,
                    role,
                    totalSessions: 0,
                    totalDuration: 0,
                    lastActive: session.last_activity_at,
                    sessions: []
                };
            }
            
            // Calculate stay duration
            let dur = session.duration_seconds;
            if (!dur) {
                const login = new Date(session.login_at).getTime();
                const lastActive = new Date(session.last_activity_at).getTime();
                dur = Math.max(0, Math.floor((lastActive - login) / 1000));
            }
            
            groups[userId].totalSessions += 1;
            groups[userId].totalDuration += dur;
            if (new Date(session.last_activity_at).getTime() > new Date(groups[userId].lastActive).getTime()) {
                groups[userId].lastActive = session.last_activity_at;
            }
            groups[userId].sessions.push(session);
        });
        
        return Object.values(groups).sort((a, b) => b.totalSessions - a.totalSessions);
    }, [filteredSessions]);

    const formatAvgDuration = (secs: number) => {
        if (secs < 60) return `${secs} secs`;
        const mins = Math.round(secs / 60);
        if (mins < 60) return `${mins} mins`;
        const hours = (mins / 60).toFixed(1);
        return `${hours} hours`;
    };

    // CSV Export utility
    const handleExportCSV = (userObj: any) => {
        if (!userObj || !userObj.sessions) return;
        
        const headers = ['User Name', 'Email', 'Role', 'Login At', 'Logout At', 'Last Activity At', 'Duration (Seconds)', 'User Agent'];
        const rows = userObj.sessions.map((s: SessionLog) => [
            userObj.name,
            userObj.email,
            userObj.role,
            s.login_at,
            s.logout_at || (isOnline(s) ? 'Active now' : 'Session timeout'),
            s.last_activity_at,
            s.duration_seconds || '',
            s.user_agent || ''
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map((row: any[]) => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `KFA_login_audit_${userObj.name.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                        {/* Tab Segment Selectors */}
                        <div className="flex border-b border-slate-200 dark:border-slate-800 w-full text-xs font-black uppercase tracking-wider font-mono select-none shrink-0">
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`flex-1 py-3 text-center border-b-2 transition-all ${activeTab === 'all' ? 'border-amber-500 text-amber-500 font-extrabold' : 'border-transparent text-slate-400'}`}
                            >
                                All Session Logs
                            </button>
                            <button
                                onClick={() => setActiveTab('months')}
                                className={`flex-1 py-3 text-center border-b-2 transition-all ${activeTab === 'months' ? 'border-amber-500 text-amber-500 font-extrabold' : 'border-transparent text-slate-400'}`}
                            >
                                Month-wise Logins
                            </button>
                            <button
                                onClick={() => setActiveTab('students')}
                                className={`flex-1 py-3 text-center border-b-2 transition-all ${activeTab === 'students' ? 'border-amber-500 text-amber-500 font-extrabold' : 'border-transparent text-slate-400'}`}
                            >
                                Group by Students
                            </button>
                        </div>

                        {/* Search and Filters */}
                        <div className="flex flex-col xl:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs w-full">
                            <div className="flex flex-col md:flex-row gap-3 w-full xl:max-w-3xl">
                                <div className="relative w-full md:max-w-xs">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by name or email..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 font-semibold"
                                    />
                                </div>

                                <div className="flex items-center gap-2 w-full md:w-auto shrink-0 select-none">
                                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
                                        <span className="text-[9px] font-black uppercase text-slate-400 font-mono">From</span>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-28 cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
                                        <span className="text-[9px] font-black uppercase text-slate-400 font-mono">To</span>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-28 cursor-pointer"
                                        />
                                    </div>
                                    {(startDate || endDate) && (
                                        <button
                                            onClick={() => { setStartDate(''); setEndDate(''); }}
                                            className="px-2 py-1.5 hover:bg-red-500/10 rounded-xl text-[10px] font-black text-red-500 hover:text-red-650 transition-colors uppercase tracking-wider"
                                            title="Clear Date Filters"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2 w-full xl:w-auto shrink-0 overflow-x-auto">
                                <button
                                    onClick={() => setFilterOnline('all')}
                                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${filterOnline === 'all' 
                                        ? 'bg-amber-500 text-white' 
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-450 hover:bg-slate-200 dark:hover:bg-slate-750'}`}
                                >
                                    All Statuses
                                </button>
                                <button
                                    onClick={() => setFilterOnline('online')}
                                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${filterOnline === 'online' 
                                        ? 'bg-emerald-500 text-white' 
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-455 hover:bg-slate-200 dark:hover:bg-slate-750'}`}
                                >
                                    <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                                    Online
                                </button>
                                <button
                                    onClick={() => setFilterOnline('offline')}
                                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${filterOnline === 'offline' 
                                        ? 'bg-slate-600 text-white' 
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-455 hover:bg-slate-200 dark:hover:bg-slate-750'}`}
                                >
                                    Offline
                                </button>
                            </div>
                        </div>

                        {/* Tab Content Tables */}
                        {activeTab === 'all' && (
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
                                                        <tr key={session.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-955/20 transition-colors">
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
                                                            <td className="px-6 py-4.5 text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">
                                                                {formatDateTime(session.login_at)}
                                                            </td>
                                                            <td className="px-6 py-4.5 text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">
                                                                {session.logout_at ? (
                                                                    formatDateTime(session.logout_at)
                                                                ) : (
                                                                    <span className="italic text-slate-450 dark:text-slate-550 font-medium">
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
                                                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-450 dark:text-slate-550 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-full border border-transparent">
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
                        )}

                        {activeTab === 'months' && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs animate-fadeIn">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                <th className="px-6 py-4">Month</th>
                                                <th className="px-6 py-4">Logins Count</th>
                                                <th className="px-6 py-4">Unique Active Users</th>
                                                <th className="px-6 py-4">Total Active Time</th>
                                                <th className="px-6 py-4">Average Stay Duration</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm font-semibold text-slate-750 dark:text-slate-300">
                                            {monthGroupedData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold">
                                                        No logins tracked during this period
                                                    </td>
                                                </tr>
                                            ) : (
                                                monthGroupedData.map((group) => {
                                                    const isExpanded = !!expandedMonths[group.monthKey];
                                                    return (
                                                        <React.Fragment key={group.monthKey}>
                                                            <tr 
                                                                className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors cursor-pointer"
                                                                onClick={() => toggleMonthExpand(group.monthKey)}
                                                            >
                                                                <td className="px-6 py-4.5 font-black text-slate-900 dark:text-white flex items-center gap-2 select-none">
                                                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-amber-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                                                                    <span>{group.monthKey}</span>
                                                                </td>
                                                                <td className="px-6 py-4.5 text-slate-650 dark:text-slate-350">
                                                                    {group.totalSessions} logins
                                                                </td>
                                                                <td className="px-6 py-4.5 text-slate-655 dark:text-slate-350">
                                                                    {group.uniqueUsers.size} users
                                                                </td>
                                                                <td className="px-6 py-4.5 font-bold text-slate-900 dark:text-white">
                                                                    {formatAvgDuration(group.totalDuration)}
                                                                </td>
                                                                <td className="px-6 py-4.5 text-amber-600 dark:text-amber-450 font-bold">
                                                                    {formatAvgDuration(Math.round(group.totalDuration / group.totalSessions))}
                                                                </td>
                                                                <td className="px-6 py-4.5 text-right" onClick={(e) => e.stopPropagation()}>
                                                                    <button
                                                                        onClick={() => handleDeleteMonth(group.monthKey, group.sessions)}
                                                                        className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white rounded-xl transition-all"
                                                                        title={`Delete logins of ${group.monthKey}`}
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr className="bg-slate-50/30 dark:bg-slate-955/5">
                                                                    <td colSpan={6} className="px-6 py-4">
                                                                        <div className="border border-slate-200 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-950 p-4 shadow-inner space-y-3">
                                                                            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-500 font-mono">
                                                                                Login Sessions in {group.monthKey}
                                                                            </h4>
                                                                            <div className="max-h-60 overflow-y-auto">
                                                                                <table className="w-full text-left border-collapse text-xs">
                                                                                    <thead>
                                                                                        <tr className="border-b border-slate-200 dark:border-slate-800/60 text-[9px] font-black uppercase tracking-widest text-slate-400 pb-2">
                                                                                            <th className="py-2 pr-4">User</th>
                                                                                            <th className="py-2 pr-4">Role</th>
                                                                                            <th className="py-2 pr-4">Login Time</th>
                                                                                            <th className="py-2 pr-4">Logout Time</th>
                                                                                            <th className="py-2 pr-4">Duration</th>
                                                                                            <th className="py-2">Device</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-900 text-slate-600 dark:text-slate-350">
                                                                                        {group.sessions.map((s) => {
                                                                                            const online = isOnline(s);
                                                                                            const { device } = parseUserAgent(s.user_agent);
                                                                                            return (
                                                                                                <tr key={s.id} className="align-middle">
                                                                                                    <td className="py-2 pr-4 font-bold text-slate-800 dark:text-slate-200">{s.users?.name || 'Unknown User'} ({s.users?.email || ''})</td>
                                                                                                    <td className="py-2 pr-4 uppercase font-black text-[8px] tracking-wider text-slate-450">{s.users?.role || 'student'}</td>
                                                                                                    <td className="py-2 pr-4 font-mono text-slate-500">{formatDateTime(s.login_at)}</td>
                                                                                                    <td className="py-2 pr-4 font-mono">
                                                                                                        {s.logout_at ? formatDateTime(s.logout_at) : (online ? <span className="text-emerald-500 font-bold">Active now</span> : <span className="italic text-slate-400">Timeout</span>)}
                                                                                                    </td>
                                                                                                    <td className="py-2 pr-4 font-bold text-slate-900 dark:text-white">{formatDuration(s.duration_seconds, s)}</td>
                                                                                                    <td className="py-2 text-slate-500">{device}</td>
                                                                                                </tr>
                                                                                            );
                                                                                        })}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'students' && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs animate-fadeIn">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                <th className="px-6 py-4">Student</th>
                                                <th className="px-6 py-4">Role</th>
                                                <th className="px-6 py-4">Total Logins</th>
                                                <th className="px-6 py-4">Total Time Spent</th>
                                                <th className="px-6 py-4">Avg Duration</th>
                                                <th className="px-6 py-4">Last Activity</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm font-semibold text-slate-750 dark:text-slate-300">
                                            {studentGroupedData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">
                                                        No student logs found matching query
                                                    </td>
                                                </tr>
                                            ) : (
                                                studentGroupedData.map((user) => {
                                                    const isExpanded = !!expandedStudents[user.userId];
                                                    return (
                                                        <React.Fragment key={user.userId}>
                                                            <tr 
                                                                className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors cursor-pointer"
                                                                onClick={() => toggleStudentExpand(user.userId)}
                                                            >
                                                                <td className="px-6 py-4.5 flex items-center gap-2 select-none">
                                                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-amber-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                                                                    <div>
                                                                        <p className="font-black text-slate-900 dark:text-white leading-tight">
                                                                            {user.name}
                                                                        </p>
                                                                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                                                                            {user.email}
                                                                        </p>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4.5">
                                                                    <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400">
                                                                        {user.role}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4.5 text-slate-650 dark:text-slate-350">
                                                                    {user.totalSessions} logins
                                                                </td>
                                                                <td className="px-6 py-4.5 font-bold text-slate-900 dark:text-white">
                                                                    {formatAvgDuration(user.totalDuration)}
                                                                </td>
                                                                <td className="px-6 py-4.5 text-slate-500 dark:text-slate-400">
                                                                    {formatAvgDuration(Math.round(user.totalDuration / user.totalSessions))}
                                                                </td>
                                                                <td className="px-6 py-4.5 text-xs text-slate-450 dark:text-slate-550 font-mono">
                                                                    {formatDateTime(user.lastActive)}
                                                                </td>
                                                                <td className="px-6 py-4.5 text-right" onClick={(e) => e.stopPropagation()}>
                                                                    <button
                                                                        onClick={() => setSelectedReportUser(user)}
                                                                        className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-[#d97706] hover:text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                                                                    >
                                                                        Generate Report
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr className="bg-slate-50/30 dark:bg-slate-955/5">
                                                                    <td colSpan={7} className="px-6 py-4">
                                                                        <div className="border border-slate-200 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-955 p-4 shadow-inner space-y-3">
                                                                            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-500 font-mono">
                                                                                Login Sessions history for {user.name}
                                                                            </h4>
                                                                            <div className="max-h-60 overflow-y-auto">
                                                                                <table className="w-full text-left border-collapse text-xs">
                                                                                    <thead>
                                                                                        <tr className="border-b border-slate-200 dark:border-slate-800/60 text-[9px] font-black uppercase tracking-widest text-slate-400 pb-2">
                                                                                            <th className="py-2 pr-4">Login Time</th>
                                                                                            <th className="py-2 pr-4">Logout Time</th>
                                                                                            <th className="py-2 pr-4">Duration</th>
                                                                                            <th className="py-2 pr-4">Device</th>
                                                                                            <th className="py-2 text-right">Status</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-900 text-slate-700 dark:text-slate-300">
                                                                                        {user.sessions.map((s) => {
                                                                                            const online = isOnline(s);
                                                                                            const { device } = parseUserAgent(s.user_agent);
                                                                                            return (
                                                                                                <tr key={s.id} className="align-middle">
                                                                                                    <td className="py-2 pr-4 font-mono text-slate-500">{formatDateTime(s.login_at)}</td>
                                                                                                    <td className="py-2 pr-4 font-mono">
                                                                                                        {s.logout_at ? formatDateTime(s.logout_at) : (online ? <span className="text-emerald-500 font-bold">Active now</span> : <span className="italic text-slate-400">Timeout</span>)}
                                                                                                    </td>
                                                                                                    <td className="py-2 pr-4 font-bold text-slate-900 dark:text-white">{formatDuration(s.duration_seconds, s)}</td>
                                                                                                    <td className="py-2 pr-4 text-slate-500">{device}</td>
                                                                                                    <td className="py-2 text-right">
                                                                                                        {online ? <span className="text-emerald-500 font-bold uppercase text-[9px]">Online</span> : <span className="text-slate-400 uppercase text-[9px]">Offline</span>}
                                                                                                    </td>
                                                                                                </tr>
                                                                                            );
                                                                                        })}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 8. PRINTABLE AUDIT REPORT MODAL */}
                    {selectedReportUser && (
                        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none no-print">
                            <style>{`
                                @media print {
                                    body * {
                                        visibility: hidden !important;
                                    }
                                    #printable-report, #printable-report * {
                                        visibility: visible !important;
                                    }
                                    #printable-report {
                                        position: absolute !important;
                                        left: 0 !important;
                                        top: 0 !important;
                                        width: 100% !important;
                                        height: auto !important;
                                        background: white !important;
                                        color: black !important;
                                        padding: 24px !important;
                                        box-shadow: none !important;
                                        border: none !important;
                                    }
                                    .no-print {
                                        display: none !important;
                                    }
                                }
                            `}</style>

                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-scaleIn text-slate-900 dark:text-slate-100">
                                {/* Modal Header actions */}
                                <div className="flex justify-between items-center mb-4 shrink-0 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
                                        Audit Report
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleExportCSV(selectedReportUser)}
                                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-200 font-black text-[10px] tracking-wide uppercase rounded-xl transition-all"
                                            title="Export CSV document"
                                        >
                                            Export CSV
                                        </button>
                                        <button 
                                            onClick={() => window.print()}
                                            className="px-3 py-1.5 bg-[#ecb613] hover:bg-amber-500 text-slate-950 font-black text-[10px] tracking-wide uppercase rounded-xl transition-all"
                                            title="Print PDF report"
                                        >
                                            Print PDF
                                        </button>
                                        <button 
                                            onClick={() => setSelectedReportUser(null)} 
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-all ml-1"
                                        >
                                            <X className="size-4.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Printable Area */}
                                <div className="flex-1 overflow-y-auto pr-1 text-left" id="printable-report">
                                    <div className="space-y-6">
                                        {/* Report Header */}
                                        <div className="flex justify-between items-start border-b border-slate-200 pb-5">
                                            <div>
                                                <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                                                    Krishna Flute Academy
                                                </h2>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1.5 font-mono">
                                                    Login Session Audit Trail
                                                </p>
                                            </div>
                                            <div className="text-right text-[10px] font-bold text-slate-450 uppercase tracking-widest font-mono">
                                                <p>Date Generated</p>
                                                <p className="text-slate-900 mt-1">{formatDateTime(new Date().toISOString())}</p>
                                            </div>
                                        </div>

                                        {/* User metadata section */}
                                        <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-250 rounded-2xl p-4 text-xs font-semibold text-slate-705">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black uppercase text-slate-400 font-mono tracking-widest leading-none">User</p>
                                                <p className="text-sm font-black text-slate-900 leading-tight">{selectedReportUser.name}</p>
                                                <p className="text-slate-500">{selectedReportUser.email}</p>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <p className="text-[9px] font-black uppercase text-slate-400 font-mono tracking-widest leading-none">Report Summary</p>
                                                <p className="text-slate-900 font-bold">Total Logins: {selectedReportUser.totalSessions} times</p>
                                                <p className="text-slate-900 font-bold">Total stay: {formatAvgDuration(selectedReportUser.totalDuration)}</p>
                                            </div>
                                        </div>

                                        {/* Detailed Logs list */}
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                                                Detailed Sessions List
                                            </h4>
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="border-b border-slate-350 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        <th className="py-2.5">#</th>
                                                        <th className="py-2.5">Login Time</th>
                                                        <th className="py-2.5">Logout Time</th>
                                                        <th className="py-2.5">Duration</th>
                                                        <th className="py-2.5">Device</th>
                                                        <th className="py-2.5 text-right">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-150 text-slate-700 font-medium">
                                                    {selectedReportUser.sessions.map((session: SessionLog, index: number) => {
                                                        const online = isOnline(session);
                                                        const { device } = parseUserAgent(session.user_agent);
                                                        return (
                                                            <tr key={session.id} className="align-middle">
                                                                <td className="py-2.5 font-bold font-mono">{index + 1}</td>
                                                                <td className="py-2.5 font-mono">{formatDateTime(session.login_at)}</td>
                                                                <td className="py-2.5 font-mono">
                                                                    {session.logout_at ? (
                                                                        formatDateTime(session.logout_at)
                                                                    ) : (
                                                                        <span className="italic text-slate-400">{online ? 'Active now' : 'Session timeout'}</span>
                                                                    )}
                                                                </td>
                                                                <td className="py-2.5 font-bold text-slate-900">
                                                                    {formatDuration(session.duration_seconds, session)}
                                                                </td>
                                                                <td className="py-2.5">{device}</td>
                                                                <td className="py-2.5 text-right font-bold uppercase text-[9px] tracking-wide">
                                                                    {online ? (
                                                                        <span className="text-emerald-600">Online</span>
                                                                    ) : (
                                                                        <span className="text-slate-450">Offline</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
