'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, Users, ShieldAlert, Award, Calendar, Coins, UserCheck, ArrowRight, ShieldCheck, Mail, Phone, BookOpen, Trash2 } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import { useToast } from '../../../src/lib/ToastContext';

interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    status: string;
    join_date: string | null;
    teacher_id: string | null;
    level: string | null;
    fees_basis: string | null;
    fees_amount: number | null;
    fees_classes_paid: number | null;
    fees_collection_date: number | null;
    classroom_students?: {
        classroom_id: string;
        classrooms?: { name: string };
    }[];
}

interface Classroom {
    id: string;
    name: string;
    teacher_id: string;
}

export default function RoleAllocationDashboard() {
    const router = useRouter();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    
    // Tabs & Filters
    const [activeTab, setActiveTab] = useState<'pending' | 'teachers' | 'students' | 'admins'>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal states
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [showAllocationModal, setShowAllocationModal] = useState(false);
    const [savingAllocation, setSavingAllocation] = useState(false);

    // Allocation Form State
    const [allocatedRole, setAllocatedRole] = useState('student');
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [selectedClassroomId, setSelectedClassroomId] = useState('');
    const [experienceLevel, setExperienceLevel] = useState('beginner');
    const [feesBasis, setFeesBasis] = useState('monthly');
    const [feesAmount, setFeesAmount] = useState('1500');
    const [feesClassesPaid, setFeesClassesPaid] = useState('0');
    const [feesCollectionDate, setFeesCollectionDate] = useState(String(new Date().getDate()));
    const [teacherClassroomIds, setTeacherClassroomIds] = useState<string[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Check Session
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) {
                router.push('/login?type=teacher');
                return;
            }

            const userId = session.user.id;

            // 2. Fetch Teacher Profile
            const { data: profile, error: profileError } = await supabaseAuth
                .from('users')
                .select('name, email, role')
                .eq('id', userId)
                .single();

            if (profileError || profile?.role !== 'admin') {
                router.push('/teacher-dashboard');
                return;
            }

            setTeacherProfile({ id: userId, name: profile.name, email: profile.email, role: profile.role });

            // 3. Fetch All Users with Classroom Student relationships
            const { data: usersData, error: usersError } = await supabaseAuth
                .from('users')
                .select(`
                    id, name, email, phone, role, status, join_date, teacher_id, level,
                    fees_basis, fees_amount, fees_classes_paid, fees_collection_date,
                    classroom_students(
                        classroom_id,
                        classrooms(name)
                    )
                `);

            if (usersError) throw usersError;
            if (usersData) {
                setUsersList(usersData as unknown as UserProfile[]);
            }

            // 4. Fetch All Classrooms
            const { data: classroomsData } = await supabaseAuth
                .from('classrooms')
                .select('id, name, teacher_id');
            
            if (classroomsData) {
                setClassrooms(classroomsData as Classroom[]);
            }

        } catch (err) {
            console.error('Error fetching role allocation data:', err);
            showToast('Failed to load portal configuration.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [router]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    const teachers = React.useMemo(() => {
        return usersList.filter(u => u.role === 'teacher' || u.role === 'admin');
    }, [usersList]);

    const filteredClassrooms = React.useMemo(() => {
        if (!selectedTeacherId) return classrooms;
        return classrooms.filter(c => c.teacher_id === selectedTeacherId);
    }, [classrooms, selectedTeacherId]);

    const filteredUsers = React.useMemo(() => {
        let result = usersList.filter(u => {
            if (activeTab === 'pending') return u.role === 'pending' || u.status === 'pending';
            
            const roleMap: Record<string, string> = {
                teachers: 'teacher',
                students: 'student',
                admins: 'admin'
            };
            const targetRole = roleMap[activeTab] || activeTab;
            
            return u.role === targetRole && u.status !== 'pending';
        });

        if (searchQuery.trim() !== '') {
            const lowerQ = searchQuery.toLowerCase();
            result = result.filter(u => 
                (u.name && u.name.toLowerCase().includes(lowerQ)) || 
                (u.email && u.email.toLowerCase().includes(lowerQ))
            );
        }

        return result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [usersList, activeTab, searchQuery]);

    const openAllocationModal = (user: UserProfile) => {
        setSelectedUser(user);
        setAllocatedRole(user.role === 'pending' ? 'student' : user.role);
        setSelectedTeacherId(user.teacher_id || '');
        
        const currentClassroom = user.classroom_students?.[0]?.classroom_id || '';
        setSelectedClassroomId(currentClassroom);
        setExperienceLevel(user.level || 'beginner');
        setFeesBasis(user.fees_basis || 'monthly');
        setFeesAmount(String(user.fees_amount || '1500'));
        setFeesClassesPaid(String(user.fees_classes_paid || '0'));
        setFeesCollectionDate(user.fees_collection_date ? String(user.fees_collection_date) : String(new Date().getDate()));
        
        const assignedClasses = classrooms.filter(c => c.teacher_id === user.id).map(c => c.id);
        setTeacherClassroomIds(assignedClasses);
        
        setShowAllocationModal(true);
    };

    const handleAllocateRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        setSavingAllocation(true);
        try {
            const isStudent = allocatedRole === 'student';
            
            const updatePayload: any = {
                role: allocatedRole,
                status: 'active',
                level: isStudent ? experienceLevel : null,
                teacher_id: isStudent ? (selectedTeacherId || null) : null,
                fees_basis: isStudent ? feesBasis : null,
                fees_amount: isStudent ? (Number(feesAmount) || 0) : null,
                fees_classes_paid: isStudent ? (Number(feesClassesPaid) || 0) : null,
                fees_collection_date: isStudent ? (feesCollectionDate ? Number(feesCollectionDate) : null) : null,
                join_date: new Date().toISOString().split('T')[0]
            };

            // 1. Update user record
            const { error: userError } = await supabaseAuth
                .from('users')
                .update(updatePayload)
                .eq('id', selectedUser.id);

            if (userError) throw userError;

            // 2. Manage Classroom assignment
            // Delete existing assignments first
            await supabaseAuth
                .from('classroom_students')
                .delete()
                .eq('student_id', selectedUser.id);

            if (isStudent && selectedClassroomId) {
                const { error: classroomError } = await supabaseAuth
                    .from('classroom_students')
                    .insert([{
                        classroom_id: selectedClassroomId,
                        student_id: selectedUser.id,
                        joined_at: new Date().toISOString()
                    }]);
                if (classroomError) throw classroomError;
            }

            if (allocatedRole === 'teacher') {
                const previouslyAssigned = classrooms.filter(c => c.teacher_id === selectedUser.id).map(c => c.id);
                const toAdd = teacherClassroomIds.filter(id => !previouslyAssigned.includes(id));
                const toRemove = previouslyAssigned.filter(id => !teacherClassroomIds.includes(id));

                if (toAdd.length > 0) {
                    const { error: addError } = await supabaseAuth
                        .from('classrooms')
                        .update({ teacher_id: selectedUser.id })
                        .in('id', toAdd);
                    if (addError) throw addError;
                }

                if (toRemove.length > 0) {
                    const { error: removeError } = await supabaseAuth
                        .from('classrooms')
                        .update({ teacher_id: null })
                        .in('id', toRemove);
                    if (removeError) throw removeError;
                }
            }

            showToast(`Successfully allocated role of ${allocatedRole} to ${selectedUser.name}!`, 'success');
            setShowAllocationModal(false);
            setSelectedUser(null);
            fetchData();

        } catch (err: any) {
            console.error('Error saving role allocation:', err);
            showToast(`Failed to allocate role: ${err.message || err}`, 'error');
        } finally {
            setSavingAllocation(false);
        }
    };

    const handleDeleteUser = async (userId: string, userName: string) => {
        if (!window.confirm(`Are you sure you want to permanently delete user "${userName}"? This will remove all their data from the portal.`)) return;

        try {
            const { error } = await supabaseAuth
                .from('users')
                .delete()
                .eq('id', userId);

            if (error) throw error;
            showToast(`User ${userName} deleted successfully.`, 'success');
            fetchData();
        } catch (err: any) {
            console.error('Error deleting user:', err);
            showToast(`Failed to delete user: ${err.message}`, 'error');
        }
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6] dark:bg-[#1a1608]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-650 dark:text-slate-400">Loading User Registrations...</p>
            </div>
        );
    }

    return (
        <div className="bg-[#f8f8f6] dark:bg-[#1a1608] text-slate-900 dark:text-slate-100 font-sans min-h-screen">
            <div className="flex h-screen overflow-hidden">
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

                <main className="flex-1 flex flex-col min-w-0">
                    <TeacherHeader 
                        title="Role Allocation" 
                        backLink={teacherProfile?.role === 'admin' ? '/admin-dashboard' : '/teacher-dashboard'}
                    />

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12">
                        <div className="w-full space-y-8">
                            
                            {/* Header Section */}
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Registration approvals</h1>
                                <p className="text-slate-550 dark:text-slate-400 mt-2.5">Review newly registered accounts and allocate portal roles, teachers, class batches, and fees parameters.</p>
                            </div>

                            {/* User Tab Filters */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                
                                {/* Filters Panel */}
                                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/40">
                                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-full md:w-auto">
                                        {[
                                            { id: 'pending', label: 'Pending approval', count: usersList.filter(u => u.role === 'pending' || u.status === 'pending').length },
                                            { id: 'teachers', label: 'Teachers', count: usersList.filter(u => u.role === 'teacher' && u.status !== 'pending').length },
                                            { id: 'students', label: 'Students', count: usersList.filter(u => u.role === 'student' && u.status !== 'pending').length },
                                            { id: 'admins', label: 'Admins', count: usersList.filter(u => u.role === 'admin' && u.status !== 'pending').length }
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id as any)}
                                                className={`px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                                                    activeTab === tab.id 
                                                        ? 'bg-white dark:bg-slate-700 text-[#b45309] dark:text-[#ecb613] shadow-sm' 
                                                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                                                }`}
                                            >
                                                <span>{tab.label}</span>
                                                {tab.count > 0 && (
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                                        activeTab === tab.id
                                                            ? 'bg-[#ecb613]/20 text-[#b45309] dark:text-[#ecb613]'
                                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                                    }`}>
                                                        {tab.count}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="relative w-full md:w-64">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                                        <input
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-850 text-xs focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] outline-none transition-all"
                                            placeholder="Search by name or email..."
                                            type="text"
                                        />
                                    </div>
                                </div>

                                {/* Mobile Cards View */}
                                <div className="block lg:hidden divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map(user => {
                                            const classroomData = user.classroom_students?.[0]?.classrooms;
                                            const class_name = Array.isArray(classroomData)
                                                ? (classroomData[0] as any)?.name || 'Not assigned'
                                                : (classroomData as any)?.name || 'Not assigned';
                                            const teacherName = teachers.find(t => t.id === user.teacher_id)?.name || 'Not assigned';
                                            
                                            return (
                                                <div key={user.id} className="p-4 space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-3">
                                                            <div className="size-10 rounded-xl bg-[#ecb613]/10 text-[#ecb613] font-black flex items-center justify-center border border-slate-100 dark:border-slate-800">
                                                                <span>{user.name?.charAt(0) || user.email?.charAt(0).toUpperCase()}</span>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{user.name || 'Unassigned Name'}</p>
                                                                <p className="text-[10px] text-slate-500 mt-1">{user.email}</p>
                                                            </div>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                                                            user.role === 'admin'
                                                                ? 'bg-red-50 text-red-600'
                                                                : user.role === 'teacher'
                                                                    ? 'bg-blue-50 text-blue-600'
                                                                    : user.role === 'student'
                                                                        ? 'bg-green-50 text-green-700'
                                                                        : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                            {user.role}
                                                        </span>
                                                    </div>
                                                    
                                                    {activeTab === 'students' && (
                                                        <div className="grid grid-cols-2 gap-2 text-xs p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                                            <div>
                                                                <span className="block text-[10px] font-bold text-slate-400 uppercase">Teacher</span>
                                                                <span className="font-semibold text-slate-700 dark:text-slate-300">{teacherName}</span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[10px] font-bold text-slate-400 uppercase">Batch</span>
                                                                <span className="font-semibold text-slate-700 dark:text-slate-300">{class_name}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            user.status === 'active'
                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                : 'bg-amber-50 text-amber-700'
                                                        }`}>
                                                            {user.status}
                                                        </span>
                                                        <div className="flex gap-2">
                                                            {activeTab === 'students' && (
                                                                <button onClick={() => setAssignTeacherModalOpen(user)} className="px-3 py-1.5 text-xs font-bold bg-[#ecb613]/10 text-[#b45309] rounded-lg">
                                                                    Assign
                                                                </button>
                                                            )}
                                                            <button onClick={() => setEditModalOpen(user)} className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg">
                                                                Edit
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="p-8 text-center text-slate-400">
                                            <p className="text-sm font-bold">No users found</p>
                                        </div>
                                    )}
                                </div>

                                {/* Table */}
                                <div className="hidden lg:block overflow-x-auto min-h-[350px]">
                                    <table className="w-full border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 bg-slate-50/20">
                                                <th className="px-6 py-4">User</th>
                                                <th className="px-6 py-4">Contact Details</th>
                                                <th className="px-6 py-4">Current Role</th>
                                                {activeTab === 'students' && (
                                                    <>
                                                        <th className="px-6 py-4">Teacher</th>
                                                        <th className="px-6 py-4">Batch Class</th>
                                                    </>
                                                )}
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {filteredUsers.length > 0 ? (
                                                filteredUsers.map(user => {
                                                    const classroomData = user.classroom_students?.[0]?.classrooms;
                                                    const class_name = Array.isArray(classroomData)
                                                        ? (classroomData[0] as any)?.name || 'Not assigned'
                                                        : (classroomData as any)?.name || 'Not assigned';
                                                    const teacherName = teachers.find(t => t.id === user.teacher_id)?.name || 'Not assigned';
                                                    
                                                    return (
                                                        <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                                                            {/* User Profile */}
                                                            <td className="px-6 py-4.5">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="size-9 rounded-xl bg-[#ecb613]/10 text-[#ecb613] font-black flex items-center justify-center border border-slate-100 dark:border-slate-800">
                                                                        <span>{user.name?.charAt(0) || user.email?.charAt(0).toUpperCase()}</span>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{user.name || 'Unassigned Name'}</p>
                                                                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wide">ID: {user.id.slice(0, 8)}</p>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Contact Details */}
                                                            <td className="px-6 py-4.5 space-y-1">
                                                                <p className="text-xs text-slate-700 dark:text-slate-350 flex items-center gap-1.5 font-medium">
                                                                    <Mail className="size-3.5 text-slate-400" />
                                                                    {user.email}
                                                                </p>
                                                                {user.phone && (
                                                                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                                                        <Phone className="size-3.5 text-slate-400" />
                                                                        {user.phone}
                                                                    </p>
                                                                )}
                                                            </td>

                                                            {/* Current Role */}
                                                            <td className="px-6 py-4.5">
                                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                                                                    user.role === 'admin'
                                                                        ? 'bg-red-50 dark:bg-red-950/20 text-red-600 border border-red-100 dark:border-red-900/30'
                                                                        : user.role === 'teacher'
                                                                            ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 border border-blue-100 dark:border-blue-900/30'
                                                                            : user.role === 'student'
                                                                                ? 'bg-green-50 dark:bg-green-950/20 text-green-700 border border-green-100 dark:border-green-900/30'
                                                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                                                }`}>
                                                                    {user.role}
                                                                </span>
                                                            </td>

                                                            {/* Student Specific Fields */}
                                                            {activeTab === 'students' && (
                                                                <>
                                                                    <td className="px-6 py-4.5 text-xs font-semibold text-slate-600 dark:text-slate-350">
                                                                        {teacherName}
                                                                    </td>
                                                                    <td className="px-6 py-4.5 text-xs font-bold text-[#b45309] dark:text-[#ecb613]">
                                                                        {class_name}
                                                                    </td>
                                                                </>
                                                            )}

                                                            {/* Status Badge */}
                                                            <td className="px-6 py-4.5">
                                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                    user.status === 'active'
                                                                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30'
                                                                        : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30'
                                                                }`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                                                                    {user.status === 'active' ? 'Approved' : 'Pending Approval'}
                                                                </span>
                                                            </td>

                                                            {/* Actions */}
                                                            <td className="px-6 py-4.5 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        onClick={() => openAllocationModal(user)}
                                                                        className="px-3 py-1.5 text-xs font-bold bg-[#ecb613] hover:bg-[#ecb613]/90 text-white rounded-lg shadow-sm shadow-[#ecb613]/10 hover:shadow transition-all active:scale-[0.97] flex items-center gap-1"
                                                                    >
                                                                        <UserCheck className="size-3.5" />
                                                                        <span>{user.role === 'pending' ? 'Allocate' : 'Edit Allocation'}</span>
                                                                    </button>
                                                                    {user.role !== 'admin' && (
                                                                        <button
                                                                            onClick={() => handleDeleteUser(user.id, user.name || user.email)}
                                                                            className="p-1.5 border border-rose-200 dark:border-rose-900/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-450 rounded-lg transition-all shadow-xs"
                                                                            title="Delete User"
                                                                        >
                                                                            <Trash2 className="size-3.5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={activeTab === 'students' ? 8 : 6} className="px-6 py-12 text-center text-slate-400">
                                                        <ShieldCheck className="size-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                                                        <p className="text-sm font-semibold">No accounts found in this category.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* ─── Role Allocation Modal ───────────────────────────────────────────── */}
            {showAllocationModal && selectedUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">Allocate User Role</h3>
                                <p className="text-xs text-slate-400 mt-1">Configuring permissions and credentials for {selectedUser.name || selectedUser.email}</p>
                            </div>
                            <button 
                                onClick={() => { setShowAllocationModal(false); setSelectedUser(null); }}
                                className="p-2 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleAllocateRole} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            
                            {/* Role Select Buttons */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Select Role</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'student', label: 'Student', icon: BookOpen, desc: 'Academy Learner' },
                                        { id: 'teacher', label: 'Teacher', icon: Award, desc: 'Music Instructor' },
                                        { id: 'admin', label: 'Admin', icon: ShieldCheck, desc: 'Full Administrator' }
                                    ].map(roleItem => (
                                        <button
                                            key={roleItem.id}
                                            type="button"
                                            onClick={() => setAllocatedRole(roleItem.id)}
                                            className={`py-3 px-4 border rounded-2xl font-bold flex flex-col items-center gap-1.5 text-center transition-all ${
                                                allocatedRole === roleItem.id
                                                    ? 'border-[#ecb613] bg-[#ecb613]/10 text-[#b45309] dark:text-[#ecb613] shadow-sm'
                                                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500'
                                            }`}
                                        >
                                            <roleItem.icon className="size-5" />
                                            <span className="text-xs leading-none">{roleItem.label}</span>
                                            <span className="text-[9px] font-normal opacity-80 leading-none">{roleItem.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Student Fields */}
                            {allocatedRole === 'student' && (
                                <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-6 animate-in slide-in-from-top-3 duration-300">
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Select Teacher */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Assign Teacher</label>
                                            <select
                                                required={allocatedRole === 'student'}
                                                value={selectedTeacherId}
                                                onChange={e => {
                                                    setSelectedTeacherId(e.target.value);
                                                    setSelectedClassroomId(''); // Reset classroom when teacher changes
                                                }}
                                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-[#ecb613]/25 outline-none font-semibold cursor-pointer"
                                            >
                                                <option value="" disabled>Select an instructor...</option>
                                                {teachers.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Select Classroom */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Assign Batch Class</label>
                                            <select
                                                required={allocatedRole === 'student'}
                                                value={selectedClassroomId}
                                                disabled={!selectedTeacherId}
                                                onChange={e => setSelectedClassroomId(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-[#ecb613]/25 outline-none font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                <option value="">{selectedTeacherId ? 'Select classroom...' : 'Select a teacher first...'}</option>
                                                {filteredClassrooms.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Experience Level */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Experience Level</label>
                                            <select
                                                value={experienceLevel}
                                                onChange={e => setExperienceLevel(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-[#ecb613]/25 outline-none font-semibold cursor-pointer"
                                            >
                                                <option value="beginner">Beginner</option>
                                                <option value="intermediate">Intermediate</option>
                                                <option value="advanced">Advanced</option>
                                            </select>
                                        </div>

                                        {/* Fees Basis */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Billing Plan</label>
                                            <select
                                                value={feesBasis}
                                                onChange={e => setFeesBasis(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-[#ecb613]/25 outline-none font-semibold cursor-pointer"
                                            >
                                                <option value="monthly">Monthly Subscription</option>
                                                <option value="class">Class-basis (Advance Booking)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        {/* Fees Amount */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Fees Amount (₹)</label>
                                            <input
                                                required={allocatedRole === 'student'}
                                                type="number"
                                                value={feesAmount}
                                                onChange={e => setFeesAmount(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#ecb613]/25 outline-none font-bold"
                                            />
                                        </div>

                                        {/* Classes Prepaid */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Prepaid Classes</label>
                                            <input
                                                required={allocatedRole === 'student'}
                                                type="number"
                                                value={feesClassesPaid}
                                                onChange={e => setFeesClassesPaid(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#ecb613]/25 outline-none font-bold"
                                            />
                                        </div>

                                        {/* Collection Date */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Due Day of Month</label>
                                            <select
                                                value={feesCollectionDate}
                                                onChange={e => setFeesCollectionDate(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#ecb613]/25 outline-none font-bold cursor-pointer"
                                            >
                                                <option value="" disabled>Select day...</option>
                                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                                    <option key={day} value={String(day)}>{day}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Teacher Fields */}
                            {allocatedRole === 'teacher' && (
                                <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-6 animate-in slide-in-from-top-3 duration-300">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Assign Classrooms</label>
                                        <p className="text-xs text-slate-500 mb-3">Select the classrooms/batches taught by this instructor:</p>
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/20 custom-scrollbar">
                                            {classrooms.map(classroom => {
                                                const isAssignedToThis = teacherClassroomIds.includes(classroom.id);
                                                const assignedTeacher = teachers.find(t => t.id === classroom.teacher_id);
                                                const isAssignedToOther = classroom.teacher_id && classroom.teacher_id !== selectedUser.id;
                                                
                                                return (
                                                    <label 
                                                        key={classroom.id} 
                                                        className="flex items-start gap-3 p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                                                    >
                                                        <input 
                                                            type="checkbox"
                                                            checked={isAssignedToThis}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setTeacherClassroomIds(prev => [...prev, classroom.id]);
                                                                } else {
                                                                    setTeacherClassroomIds(prev => prev.filter(id => id !== classroom.id));
                                                                }
                                                            }}
                                                            className="rounded border-slate-350 dark:border-slate-700 text-[#ecb613] focus:ring-[#ecb613] h-4 w-4 mt-0.5"
                                                        />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{classroom.name}</span>
                                                            {isAssignedToOther && (
                                                                <span className="text-[9px] text-slate-400 font-bold">Currently taught by {assignedTeacher?.name || 'another teacher'}</span>
                                                            )}
                                                            {!classroom.teacher_id && (
                                                                <span className="text-[9px] text-amber-600 font-bold">Unassigned Class</span>
                                                            )}
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                            {classrooms.length === 0 && (
                                                <p className="text-xs text-slate-400 italic text-center py-4">No classrooms created yet.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions Footer */}
                            <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
                                <button
                                    type="button"
                                    onClick={() => { setShowAllocationModal(false); setSelectedUser(null); }}
                                    className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-650 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingAllocation}
                                    className="px-6 py-2.5 rounded-xl bg-[#ecb613] text-slate-900 text-xs font-black shadow-lg shadow-[#ecb613]/20 hover:bg-[#ecb613]/90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {savingAllocation ? (
                                        <><Loader2 className="size-3.5 animate-spin" /> Saving...</>
                                    ) : (
                                        <>
                                            <UserCheck className="size-4" />
                                            <span>Assign & Activate</span>
                                        </>
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
