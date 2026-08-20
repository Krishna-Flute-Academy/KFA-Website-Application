'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, UserCheck, Plus, Trash2, Search, Sparkles, 
    ShieldCheck, AlertCircle, CheckCircle2, Loader2, RefreshCw, X, Award
} from 'lucide-react';
import { supabaseAuth } from '../../lib/supabase-auth';

interface UserProfile {
    id: string;
    name: string;
    email: string;
    role: string;
    level?: string;
    classroom_name?: string;
}

interface MentorshipPair {
    id: string;
    student_id: string;
    mentor_id: string;
    student_name: string;
    mentor_name: string;
    student_email: string;
    mentor_email: string;
    created_at: string;
}

export default function TeacherMentorManagement() {
    const [loading, setLoading] = useState(true);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [mentorshipPairs, setMentorshipPairs] = useState<MentorshipPair[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Assignment modal state
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedMentorId, setSelectedMentorId] = useState<string>('');
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [mentorSearchQuery, setMentorSearchQuery] = useState('');
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [seniorMentorSearch, setSeniorMentorSearch] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Fetch users and mentorship pairs
    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch users
            const { data: usersData, error: usersErr } = await supabaseAuth
                .from('users')
                .select('id, name, email, role, level')
                .order('name');
            if (usersErr) throw usersErr;
            setAllUsers(usersData || []);

            // Fetch student_mentors
            const { data: pairsData, error: pairsErr } = await supabaseAuth
                .from('student_mentors')
                .select(`
                    id,
                    student_id,
                    mentor_id,
                    created_at,
                    student:users!student_mentors_student_id_fkey(name, email),
                    mentor:users!student_mentors_mentor_id_fkey(name, email)
                `);

            if (pairsErr) {
                if (pairsErr.message?.includes('schema cache') || pairsErr.message?.includes('does not exist') || pairsErr.code === 'PGRST205' || pairsErr.code === '42P01') {
                    setAlertMessage({ 
                        type: 'error', 
                        text: "Database table 'public.student_mentors' was not found in Supabase. Please run the SQL migration script in your Supabase SQL Editor." 
                    });
                } else {
                    // Fallback query if raw join fails
                    const { data: rawPairs } = await supabaseAuth.from('student_mentors').select('*');
                    if (rawPairs && usersData) {
                        const formatted = rawPairs.map(p => {
                            const s = usersData.find(u => u.id === p.student_id);
                            const m = usersData.find(u => u.id === p.mentor_id);
                            return {
                                id: p.id,
                                student_id: p.student_id,
                                mentor_id: p.mentor_id,
                                student_name: s?.name || 'Unknown Student',
                                mentor_name: m?.name || 'Unknown Mentor',
                                student_email: s?.email || '',
                                mentor_email: m?.email || '',
                                created_at: p.created_at
                            };
                        });
                        setMentorshipPairs(formatted);
                    }
                }
            } else if (pairsData) {
                const formatted = pairsData.map((p: any) => ({
                    id: p.id,
                    student_id: p.student_id,
                    mentor_id: p.mentor_id,
                    student_name: p.student?.name || 'Unknown Student',
                    mentor_name: p.mentor?.name || 'Unknown Mentor',
                    student_email: p.student?.email || '',
                    mentor_email: p.mentor?.email || '',
                    created_at: p.created_at
                }));
                setMentorshipPairs(formatted);
            }
        } catch (e: any) {
            console.error('Error fetching mentorship data:', e);
            setAlertMessage({ type: 'error', text: e.message || 'Failed to load data.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter mentors (users with role === 'mentor' or users acting as mentors)
    const mentorsList = useMemo(() => {
        return allUsers.filter(u => {
            const isMentorUser = u.role === 'mentor' || mentorshipPairs.some(p => p.mentor_id === u.id);
            if (!isMentorUser) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
        });
    }, [allUsers, mentorshipPairs, searchQuery]);

    // Students available for mentor assignment
    const eligibleStudents = useMemo(() => {
        return allUsers.filter(u => u.role === 'student' || u.role === 'pending');
    }, [allUsers]);

    // Filtered mentor options for assignment modal search (ONLY users promoted as Mentors)
    const filteredMentorOptions = useMemo(() => {
        return allUsers.filter(u => {
            const isMentorUser = u.role === 'mentor' || mentorshipPairs.some(p => p.mentor_id === u.id);
            if (!isMentorUser) return false;
            if (!mentorSearchQuery.trim()) return true;
            const q = mentorSearchQuery.toLowerCase();
            return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.level || '').toLowerCase().includes(q);
        });
    }, [allUsers, mentorshipPairs, mentorSearchQuery]);

    // Filtered student options for assignment modal search
    const filteredStudentOptions = useMemo(() => {
        return eligibleStudents.filter(u => {
            if (!studentSearchQuery.trim()) return true;
            const q = studentSearchQuery.toLowerCase();
            return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.level || '').toLowerCase().includes(q);
        });
    }, [eligibleStudents, studentSearchQuery]);

    // Grouped mentorship pairs by Mentor (Mentor Heading -> Mentees underneath)
    const groupedMentorships = useMemo(() => {
        const map = new Map<string, { mentor_id: string; mentor_name: string; mentor_email: string; mentees: MentorshipPair[] }>();

        mentorshipPairs.forEach(pair => {
            if (!map.has(pair.mentor_id)) {
                map.set(pair.mentor_id, {
                    mentor_id: pair.mentor_id,
                    mentor_name: pair.mentor_name,
                    mentor_email: pair.mentor_email,
                    mentees: []
                });
            }
            map.get(pair.mentor_id)!.mentees.push(pair);
        });

        let groups = Array.from(map.values());

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            groups = groups.map(g => {
                const mentorMatches = g.mentor_name.toLowerCase().includes(q) || g.mentor_email.toLowerCase().includes(q);
                const filteredMentees = g.mentees.filter(m => 
                    mentorMatches || 
                    m.student_name.toLowerCase().includes(q) || 
                    m.student_email.toLowerCase().includes(q)
                );
                return { ...g, mentees: filteredMentees };
            }).filter(g => g.mentees.length > 0);
        }

        return groups;
    }, [mentorshipPairs, searchQuery]);

    // Toggle Role between Student and Mentor
    const handleToggleMentorRole = async (user: UserProfile) => {
        const newRole = user.role === 'mentor' ? 'student' : 'mentor';
        try {
            const { error } = await supabaseAuth
                .from('users')
                .update({ role: newRole })
                .eq('id', user.id);

            if (error) {
                if (error.message?.includes('users_role_check')) {
                    throw new Error("Database role constraint error: Please run the SQL migration in Supabase SQL editor: ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check; ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'teacher', 'admin', 'pending', 'mentor'));");
                }
                throw error;
            }

            setAlertMessage({ 
                type: 'success', 
                text: `${user.name} role updated to ${newRole.toUpperCase()}.` 
            });

            setAllUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
        } catch (e: any) {
            setAlertMessage({ type: 'error', text: e.message || 'Failed to update role.' });
        }
    };

    // Assign Students to Mentor (Bulk Multi-Student Support)
    const handleAssignMentorship = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMentorId) {
            setAlertMessage({ type: 'error', text: 'Please select a Senior Mentor.' });
            return;
        }

        if (selectedStudentIds.length === 0) {
            setAlertMessage({ type: 'error', text: 'Please select at least one student to pair.' });
            return;
        }

        if (selectedStudentIds.includes(selectedMentorId)) {
            setAlertMessage({ type: 'error', text: 'A student cannot be assigned as their own mentor.' });
            return;
        }

        setIsSubmitting(true);
        try {
            // Delete existing pairings for selected students
            await supabaseAuth.from('student_mentors').delete().in('student_id', selectedStudentIds);

            // Insert new pairings for all selected students
            const rowsToInsert = selectedStudentIds.map(stId => ({
                student_id: stId,
                mentor_id: selectedMentorId
            }));

            const { error } = await supabaseAuth.from('student_mentors').insert(rowsToInsert);
            if (error) throw error;

            // Safely attempt role update for mentor (swallowing check constraint error if present)
            try {
                const mentorUser = allUsers.find(u => u.id === selectedMentorId);
                if (mentorUser && mentorUser.role !== 'mentor') {
                    await supabaseAuth.from('users').update({ role: 'mentor' }).eq('id', selectedMentorId);
                }
            } catch (roleErr) {
                console.warn('Could not update users.role column (run users_role_check migration if needed):', roleErr);
            }

            setAlertMessage({ 
                type: 'success', 
                text: `Successfully assigned ${selectedStudentIds.length} student(s) to Mentor!` 
            });
            setShowAssignModal(false);
            setSelectedStudentIds([]);
            await fetchData();
        } catch (e: any) {
            setAlertMessage({ type: 'error', text: e.message || 'Failed to assign mentor.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Remove Mentorship
    const handleRemovePair = async (pairId: string) => {
        try {
            const { error } = await supabaseAuth.from('student_mentors').delete().eq('id', pairId);
            if (error) throw error;

            setAlertMessage({ type: 'success', text: 'Mentorship assignment removed.' });
            setMentorshipPairs(prev => prev.filter(p => p.id !== pairId));
        } catch (e: any) {
            setAlertMessage({ type: 'error', text: e.message || 'Failed to remove assignment.' });
        }
    };

    return (
        <div className="p-6 space-y-6 text-left animate-in fade-in duration-300">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xs">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold mb-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Senior Student Mentorship Management</span>
                    </div>
                    <h1 className="admin-page-title">Mentor Allocation & Task Evaluation Roles</h1>
                    <p className="admin-page-subtitle">
                        Promote senior students to Mentors and allocate junior students to receive guidance and task reviews.
                    </p>
                </div>

                <div className="admin-btn-group">
                    <button
                        onClick={fetchData}
                        className="admin-btn admin-btn-secondary"
                        title="Refresh Mentorship Data"
                    >
                        <RefreshCw className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                    <button
                        onClick={() => {
                            setShowAssignModal(true);
                            if (mentorsList.length > 0) setSelectedMentorId(mentorsList[0].id);
                        }}
                        className="admin-btn admin-btn-primary"
                        title="Assign Mentor to Student"
                    >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">Assign Mentor to Student</span>
                    </button>
                </div>
            </div>

            {/* Alert banner */}
            {alertMessage && (
                <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                    alertMessage.type === 'success' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300' 
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300'
                }`}>
                    <div className="flex items-center gap-2">
                        {alertMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        <span>{alertMessage.text}</span>
                    </div>
                    <button onClick={() => setAlertMessage(null)} className="hover:opacity-75">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: Active Mentors & Role Promotion */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col h-fit">
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="font-extrabold text-slate-800 dark:text-white text-base flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-amber-600" />
                            <span>Senior Mentors</span>
                        </h3>
                        <span className="text-xs font-black text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200">
                            {allUsers.filter(u => u.role === 'mentor').length} Mentors
                        </span>
                    </div>

                    {/* Dedicated Search Input for Senior Mentors */}
                    <div className="relative mb-3">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search mentors & students..."
                            value={seniorMentorSearch}
                            onChange={(e) => setSeniorMentorSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-white"
                        />
                    </div>

                    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                        {allUsers
                            .filter(u => u.role === 'mentor' || u.role === 'student')
                            .filter(u => {
                                if (!seniorMentorSearch.trim()) return true;
                                const q = seniorMentorSearch.toLowerCase();
                                return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.level || '').toLowerCase().includes(q);
                            })
                            .map((user) => {
                            const isMentor = user.role === 'mentor';
                            const menteeCount = mentorshipPairs.filter(p => p.mentor_id === user.id).length;

                            return (
                                <div
                                    key={user.id}
                                    className="p-3.5 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between gap-3"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-extrabold text-xs text-slate-800 dark:text-white truncate">{user.name}</h4>
                                            {isMentor && (
                                                <span className="text-[8px] font-black bg-amber-500 text-white px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0">
                                                    Mentor
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
                                        <p className="text-[9px] font-bold text-amber-600 mt-1">{menteeCount} Mentees assigned</p>
                                    </div>

                                    <button
                                        onClick={() => handleToggleMentorRole(user)}
                                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold transition-all border cursor-pointer ${
                                            isMentor
                                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border-rose-200 dark:border-rose-900/40 hover:bg-rose-100'
                                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/40 hover:bg-amber-100'
                                        }`}
                                    >
                                        {isMentor ? 'Remove Mentor Role' : 'Promote to Mentor'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Column 2: Mentor-Mentee Allocation Pairs */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <h3 className="font-extrabold text-slate-800 dark:text-white text-base">Mentorship Assignments</h3>
                            <p className="text-xs text-slate-400">Senior Mentors and students assigned under them.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative w-full sm:w-56">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search by student or mentor..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-white"
                                />
                            </div>
                            <span className="text-xs font-black text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl shrink-0">
                                {mentorshipPairs.length} Pairings
                            </span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-20 text-center text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-500" />
                            <p className="text-xs font-bold">Loading mentorship pairs...</p>
                        </div>
                    ) : groupedMentorships.length === 0 ? (
                        <div className="py-20 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20">
                            <Users className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {searchQuery ? 'No mentorship pairs match your search' : 'No active mentor assignments'}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">Click "Assign Mentor to Student" to pair senior students with junior mentees.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {groupedMentorships.map((group) => (
                                <div
                                    key={group.mentor_id}
                                    className="rounded-3xl border border-amber-200/80 dark:border-amber-900/30 bg-amber-50/20 dark:bg-amber-950/10 p-4 shadow-xs space-y-3"
                                >
                                    {/* Mentor Heading Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/60 dark:border-amber-900/30">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                                                {group.mentor_name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                                                        {group.mentor_name}
                                                    </h4>
                                                    <span className="text-[9px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                        Senior Mentor
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-0.5">{group.mentor_email}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-3 py-1 rounded-xl border border-amber-200 dark:border-amber-900/50">
                                                {group.mentees.length} Student{group.mentees.length === 1 ? '' : 's'} Assigned
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setSelectedMentorId(group.mentor_id);
                                                    setShowAssignModal(true);
                                                }}
                                                className="px-3 py-1 rounded-xl bg-[#7C5E3F] hover:bg-amber-800 text-white text-xs font-extrabold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Add Student</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Mentees List under this Mentor */}
                                    <div className="divide-y divide-slate-150 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                                        {group.mentees.map((mentee) => (
                                            <div
                                                key={mentee.id}
                                                className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-850/60 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold text-xs flex items-center justify-center shrink-0">
                                                        {mentee.student_name.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Student</span>
                                                            <h5 className="font-extrabold text-xs text-slate-800 dark:text-white truncate">
                                                                {mentee.student_name}
                                                            </h5>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 truncate">{mentee.student_email}</p>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleRemovePair(mentee.id)}
                                                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900/40 text-[10px] font-extrabold hover:bg-rose-100 flex items-center gap-1 transition-all cursor-pointer shrink-0"
                                                    title="Unpair student from mentor"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    <span>Unpair Student</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ASSIGNMENT MODAL */}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative text-left">
                        <button
                            onClick={() => setShowAssignModal(false)}
                            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                                <Award className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Assign Mentor to Student</h3>
                                <p className="text-xs text-slate-400">Select a Senior Mentor and student to pair.</p>
                            </div>
                        </div>

                        <form onSubmit={handleAssignMentorship} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Search & Select Senior Mentor *
                                </label>
                                <div className="relative mb-2">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Type to filter mentors..."
                                        value={mentorSearchQuery}
                                        onChange={(e) => setMentorSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-white"
                                    />
                                </div>
                                <select
                                    required
                                    value={selectedMentorId}
                                    onChange={(e) => setSelectedMentorId(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                                >
                                    <option value="">-- Choose Mentor ({filteredMentorOptions.length} available) --</option>
                                    {filteredMentorOptions.map(u => {
                                        const count = mentorshipPairs.filter(p => p.mentor_id === u.id).length;
                                        return (
                                            <option key={u.id} value={u.id}>
                                                {u.name} ({u.role === 'mentor' ? 'Mentor' : 'Student'}) — {count} Mentee{count === 1 ? '' : 's'} Assigned — {u.email}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Search & Select Student(s) / Mentee(s) *
                                    </label>
                                    <span className="text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200">
                                        {selectedStudentIds.length} Selected
                                    </span>
                                </div>
                                <div className="relative mb-2">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Search students (e.g. Advait, Pranshu, Rutheek)..."
                                        value={studentSearchQuery}
                                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-white"
                                    />
                                </div>

                                {/* Select All / Deselect Controls */}
                                <div className="flex items-center justify-between px-1 mb-1 text-[10px]">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const allFilteredIds = filteredStudentOptions.map(s => s.id);
                                            const combined = Array.from(new Set([...selectedStudentIds, ...allFilteredIds]));
                                            setSelectedStudentIds(combined);
                                        }}
                                        className="font-bold text-amber-600 hover:underline cursor-pointer"
                                    >
                                        + Select All Filtered ({filteredStudentOptions.length})
                                    </button>
                                    {selectedStudentIds.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedStudentIds([])}
                                            className="font-bold text-rose-500 hover:underline cursor-pointer"
                                        >
                                            Clear Selection
                                        </button>
                                    )}
                                </div>

                                {/* Multi-Checkbox Student List */}
                                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-850/50 space-y-1">
                                    {filteredStudentOptions.length > 0 ? (
                                        filteredStudentOptions.map(u => {
                                            const isSelected = selectedStudentIds.includes(u.id);
                                            return (
                                                <div
                                                    key={u.id}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setSelectedStudentIds(prev => prev.filter(id => id !== u.id));
                                                        } else {
                                                            setSelectedStudentIds(prev => [...prev, u.id]);
                                                        }
                                                    }}
                                                    className={`flex items-center gap-2.5 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                                                        isSelected
                                                            ? 'bg-amber-500/10 border border-amber-500/30 font-bold text-slate-900 dark:text-white'
                                                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {}} // handled by row onClick
                                                        className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="truncate block font-extrabold">{u.name}</span>
                                                        <span className="text-[10px] text-slate-400 truncate block">{u.email}</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-center text-xs text-slate-400 py-3">No matching students found.</p>
                                    )}
                                </div>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAssignModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 rounded-xl bg-[#7C5E3F] hover:bg-amber-800 text-white font-extrabold text-xs shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Assigning...</span>
                                        </>
                                    ) : (
                                        <span>Confirm Pairing</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
