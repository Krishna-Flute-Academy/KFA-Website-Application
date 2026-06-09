'use client';

import React, { useEffect, useState } from 'react';
import { supabaseAuth } from '../../src/lib/supabase-auth';
import { Loader2, UserCheck, AlertTriangle, ShieldCheck, UserPlus } from 'lucide-react';

export default function TempDebugPage() {
    const [loading, setLoading] = useState(true);
    const [sessionUser, setSessionUser] = useState<any>(null);
    const [usersList, setUsersList] = useState<any[]>([]);
    const [targetStudent, setTargetStudent] = useState<any>(null);
    const [searchId, setSearchId] = useState('07e35999-0087-4144-b16c-9394283fc260');
    const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [creating, setCreating] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        setMsg(null);
        try {
            // 1. Get session
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) {
                setMsg({ text: 'No active session found. Please log in as a teacher first, then visit this page.', type: 'error' });
                setLoading(false);
                return;
            }
            setSessionUser(session.user);

            // 2. Query all users
            const { data: users, error: usersError } = await supabaseAuth
                .from('users')
                .select('*');

            if (usersError) {
                setMsg({ text: `Failed to fetch users: ${usersError.message}`, type: 'error' });
                setLoading(false);
                return;
            }

            setUsersList(users || []);

            // 3. Find the target student
            const student = users?.find(u => u.id === searchId);
            setTargetStudent(student || null);

        } catch (err: any) {
            setMsg({ text: `An error occurred: ${err.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateProfile = async () => {
        if (!sessionUser) return;
        setCreating(true);
        setMsg(null);
        try {
            const { error } = await supabaseAuth
                .from('users')
                .insert([{
                    id: searchId,
                    name: 'Krishna Gopal',
                    email: 'krishna.gopal@example.com', // fallback or dummy email
                    role: 'student',
                    status: 'active',
                    teacher_id: sessionUser.id,
                    join_date: new Date().toISOString().split('T')[0],
                    level: 'beginner'
                }]);

            if (error) {
                setMsg({ text: `Failed to create profile row: ${error.message}`, type: 'error' });
            } else {
                setMsg({ text: 'Profile row created successfully! Navigating to reload...', type: 'success' });
                await fetchData();
            }
        } catch (err: any) {
            setMsg({ text: `Error: ${err.message}`, type: 'error' });
        } finally {
            setCreating(false);
        }
    };

    const handleAssignToMe = async (studentId: string) => {
        if (!sessionUser) return;
        setLoading(true);
        setMsg(null);
        try {
            const { error } = await supabaseAuth
                .from('users')
                .update({ teacher_id: sessionUser.id })
                .eq('id', studentId);

            if (error) {
                setMsg({ text: `Failed to assign student: ${error.message}`, type: 'error' });
            } else {
                setMsg({ text: 'Student assigned to you successfully!', type: 'success' });
                await fetchData();
            }
        } catch (err: any) {
            setMsg({ text: `Error: ${err.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8f8f6] py-12 px-6 font-sans text-slate-800">
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h1 className="text-2xl font-bold text-slate-950 flex items-center gap-2">
                        <ShieldCheck className="text-amber-500 w-7 h-7" />
                        Database Diagnostics & Student Management
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Use this utility to diagnose why a student is missing and assign/create their public profile.
                    </p>
                </div>

                {/* Status Message */}
                {msg && (
                    <div className={`p-4 rounded-xl border ${
                        msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                        msg.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                        'bg-blue-50 border-blue-200 text-blue-800'
                    }`}>
                        <p className="text-sm font-semibold">{msg.text}</p>
                    </div>
                )}

                {/* Session Info */}
                {sessionUser && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Logged In Teacher Profile</h2>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
                                {sessionUser.email ? sessionUser.email.charAt(0).toUpperCase() : 'T'}
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">{sessionUser.email}</p>
                                <p className="text-xs text-slate-500">ID: {sessionUser.id}</p>
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
                        <p className="text-sm text-slate-500">Running database queries...</p>
                    </div>
                ) : (
                    <>
                        {/* Target Student Analysis */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                            <h2 className="text-lg font-bold text-slate-950 flex items-center gap-1.5">
                                <UserCheck className="text-amber-500" />
                                Target Student Profile Verification
                            </h2>
                            <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                                <p className="text-sm"><span className="font-semibold">Search ID:</span> <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">{searchId}</code></p>
                                <p className="text-sm"><span className="font-semibold">Status in public.users:</span> {targetStudent ? (
                                    <span className="text-green-600 font-bold">FOUND</span>
                                ) : (
                                    <span className="text-rose-500 font-bold">NOT FOUND</span>
                                )}</p>
                            </div>

                            {targetStudent ? (
                                <div className="border border-green-200 bg-green-50/50 p-4 rounded-xl space-y-3">
                                    <h3 className="font-bold text-green-800 text-sm">Student Record Details</h3>
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <p><span className="font-semibold text-slate-500">Name:</span> {targetStudent.name}</p>
                                        <p><span className="font-semibold text-slate-500">Email:</span> {targetStudent.email || 'N/A'}</p>
                                        <p><span className="font-semibold text-slate-500">Role:</span> {targetStudent.role}</p>
                                        <p><span className="font-semibold text-slate-500">Status:</span> {targetStudent.status}</p>
                                        <p><span className="font-semibold text-slate-500">Assigned Teacher ID:</span> {targetStudent.teacher_id || <span className="text-rose-500 font-bold">NULL (Unassigned)</span>}</p>
                                        <p><span className="font-semibold text-slate-500">Join Date:</span> {targetStudent.join_date}</p>
                                    </div>
                                    {targetStudent.teacher_id !== sessionUser?.id && (
                                        <button
                                            onClick={() => handleAssignToMe(targetStudent.id)}
                                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg text-xs mt-2 transition-colors"
                                        >
                                            Assign to My Roster (Set teacher_id to me)
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="border border-rose-200 bg-rose-50/50 p-4 rounded-xl space-y-3">
                                    <div className="flex items-start gap-2 text-rose-800">
                                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h3 className="font-bold text-sm">Missing Profile Row</h3>
                                            <p className="text-xs text-rose-700 mt-1">
                                                The authentication account exists in Supabase Auth, but the corresponding user profile was never created in the public.users database table.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCreateProfile}
                                        disabled={creating}
                                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-5 rounded-lg text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        {creating ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <UserPlus className="w-4 h-4" />
                                        )}
                                        Create public.users Profile Row for "Krishna Gopal"
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Complete Users List */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-950 mb-4">All Registered Users ({usersList.length})</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase">
                                            <th className="py-2">Name</th>
                                            <th className="py-2">Email</th>
                                            <th className="py-2">Role</th>
                                            <th className="py-2">Teacher ID</th>
                                            <th className="py-2">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {usersList.map((u) => (
                                            <tr key={u.id} className="hover:bg-slate-50">
                                                <td className="py-3 font-semibold">{u.name}</td>
                                                <td className="py-3">{u.email || 'N/A'}</td>
                                                <td className="py-3 capitalize">{u.role}</td>
                                                <td className="py-3 text-slate-500 font-mono">{u.teacher_id || 'NULL'}</td>
                                                <td className="py-3">
                                                    {u.role === 'student' && u.teacher_id !== sessionUser?.id && (
                                                        <button
                                                            onClick={() => handleAssignToMe(u.id)}
                                                            className="text-amber-600 hover:underline font-bold"
                                                        >
                                                            Assign to Me
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
