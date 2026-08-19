'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { 
    Loader2, Users, ShieldAlert, Award, Calendar, Coins, UserCheck, 
    ArrowRight, ShieldCheck, Mail, Phone, BookOpen, Trash2,
    ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Download, FileSpreadsheet
} from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import TeacherMentorManagement from '../../../src/components/teacher-dashboard/TeacherMentorManagement';
import { useToast } from '../../../src/lib/ToastContext';
import { sortClassroomsByDayAndTime } from '../../../src/lib/classroomSort';
import { exportRoleAllocationCSV } from '../../../src/lib/csv-export';

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
    learning_mode?: string | null;
    fees_basis: string | null;
    fees_amount: number | null;
    fees_classes_paid: number | null;
    fees_collection_date: number | null;
    profile_pic_url?: string | null;
    classroom_students?: {
        classroom_id: string;
        classrooms?: { name: string } | { name: string }[];
    }[];
}

interface Classroom {
    id: string;
    name: string;
    teacher_id: string;
    status?: string;
}

type SortField = 'name' | 'contact' | 'role' | 'teacher' | 'classroom' | 'billing' | 'dueDate' | 'status';
type SortOrder = 'asc' | 'desc';

export default function RoleAllocationDashboard() {
    const router = useRouter();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; phone?: string | null; role?: string; profile_pic_url?: string | null } | null>(null);
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    
    // Tabs & Filters
    const [activeTab, setActiveTab] = useState<'pending' | 'teachers' | 'students' | 'admins' | 'mentors'>('pending');
    const [searchQuery, setSearchQuery] = useState('');

    // Column Sorting State
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    // Column Filter States
    const [colUserFilter, setColUserFilter] = useState('');
    const [colContactFilter, setColContactFilter] = useState('');
    const [colRoleFilter, setColRoleFilter] = useState('all');
    const [colTeacherFilter, setColTeacherFilter] = useState('all');
    const [colClassroomFilter, setColClassroomFilter] = useState('all');
    const [colBillingFilter, setColBillingFilter] = useState('all');
    const [colDueDateFilter, setColDueDateFilter] = useState('all');
    const [colStatusFilter, setColStatusFilter] = useState('all');
    
    // Modal states
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [showAllocationModal, setShowAllocationModal] = useState(false);
    const [savingAllocation, setSavingAllocation] = useState(false);

    // Allocation Form State
    const [allocatedRole, setAllocatedRole] = useState('student');
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [selectedClassroomId, setSelectedClassroomId] = useState('');
    const [experienceLevel, setExperienceLevel] = useState('beginner');
    const [learningMode, setLearningMode] = useState('online');
    const [feesBasis, setFeesBasis] = useState('monthly');
    const [feesAmount, setFeesAmount] = useState('1500');
    const [feesClassesPaid, setFeesClassesPaid] = useState('0');
    const [feesCollectionDate, setFeesCollectionDate] = useState(String(new Date().getDate()));
    const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
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
                .select('name, email, phone, role, profile_pic_url')
                .eq('id', userId)
                .single();

            if (profileError || profile?.role !== 'admin') {
                router.push('/teacher-dashboard');
                return;
            }

            setTeacherProfile({ id: userId, name: profile.name, email: profile.email, phone: profile.phone, role: profile.role, profile_pic_url: profile.profile_pic_url });

            // 3. Fetch All Users and Classrooms IN PARALLEL!
            const usersReq = supabaseAuth
                .from('users')
                .select(`
                    id, name, email, phone, role, status, join_date, teacher_id, level, learning_mode,
                    fees_basis, fees_amount, fees_classes_paid, fees_collection_date, profile_pic_url,
                    classroom_students(
                        classroom_id,
                        classrooms(name)
                    )
                `);

            const classroomsReq = supabaseAuth
                .from('classrooms')
                .select('id, name, teacher_id, status');

            const [
                { data: usersData, error: usersError },
                { data: classroomsData }
            ] = await Promise.all([
                usersReq,
                classroomsReq
            ]);

            if (usersError) throw usersError;
            if (usersData) {
                setUsersList(usersData as unknown as UserProfile[]);
            }
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

    const uniqueBatches = React.useMemo(() => {
        const names = new Set<string>();
        classrooms.forEach(c => {
            if (c.name) names.add(c.name);
        });
        return Array.from(names).sort();
    }, [classrooms]);

    const filteredClassrooms = React.useMemo(() => {
        const activeRooms = classrooms.filter(c => c.status === 'active');
        const targetRooms = selectedTeacherId ? activeRooms.filter(c => c.teacher_id === selectedTeacherId) : activeRooms;
        return sortClassroomsByDayAndTime(targetRooms);
    }, [classrooms, selectedTeacherId]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const hasActiveFilters = React.useMemo(() => {
        return (
            searchQuery.trim() !== '' ||
            colUserFilter.trim() !== '' ||
            colContactFilter.trim() !== '' ||
            colRoleFilter !== 'all' ||
            colTeacherFilter !== 'all' ||
            colClassroomFilter !== 'all' ||
            colBillingFilter !== 'all' ||
            colDueDateFilter !== 'all' ||
            colStatusFilter !== 'all' ||
            sortField !== 'name' ||
            sortOrder !== 'asc'
        );
    }, [
        searchQuery, colUserFilter, colContactFilter, colRoleFilter,
        colTeacherFilter, colClassroomFilter, colBillingFilter,
        colDueDateFilter, colStatusFilter, sortField, sortOrder
    ]);

    const clearAllFilters = () => {
        setSearchQuery('');
        setColUserFilter('');
        setColContactFilter('');
        setColRoleFilter('all');
        setColTeacherFilter('all');
        setColClassroomFilter('all');
        setColBillingFilter('all');
        setColDueDateFilter('all');
        setColStatusFilter('all');
        setSortField('name');
        setSortOrder('asc');
    };

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

        // 1. Search Query
        if (searchQuery.trim() !== '') {
            const lowerQ = searchQuery.toLowerCase();
            result = result.filter(u => 
                (u.name && u.name.toLowerCase().includes(lowerQ)) || 
                (u.email && u.email.toLowerCase().includes(lowerQ))
            );
        }

        // 2. Column Filters
        if (colUserFilter.trim() !== '') {
            const q = colUserFilter.toLowerCase();
            result = result.filter(u => 
                (u.name && u.name.toLowerCase().includes(q)) ||
                (u.id && u.id.toLowerCase().includes(q))
            );
        }

        if (colContactFilter.trim() !== '') {
            const q = colContactFilter.toLowerCase();
            result = result.filter(u => 
                (u.email && u.email.toLowerCase().includes(q)) ||
                (u.phone && u.phone.toLowerCase().includes(q))
            );
        }

        if (colRoleFilter !== 'all') {
            result = result.filter(u => u.role === colRoleFilter);
        }

        if (colTeacherFilter !== 'all') {
            if (colTeacherFilter === 'unassigned') {
                result = result.filter(u => !u.teacher_id);
            } else {
                result = result.filter(u => u.teacher_id === colTeacherFilter);
            }
        }

        if (colClassroomFilter !== 'all') {
            if (colClassroomFilter === 'unassigned') {
                result = result.filter(u => {
                    const cData = u.classroom_students?.[0]?.classrooms;
                    const cName = Array.isArray(cData) ? (cData[0] as any)?.name : (cData as any)?.name;
                    return !cName;
                });
            } else {
                result = result.filter(u => {
                    const cData = u.classroom_students?.[0]?.classrooms;
                    const cName = Array.isArray(cData) ? (cData[0] as any)?.name : (cData as any)?.name;
                    return cName === colClassroomFilter;
                });
            }
        }

        if (colBillingFilter !== 'all') {
            if (colBillingFilter === 'none') {
                result = result.filter(u => !u.fees_basis);
            } else {
                result = result.filter(u => u.fees_basis === colBillingFilter);
            }
        }

        if (colDueDateFilter !== 'all') {
            result = result.filter(u => String(u.fees_collection_date) === colDueDateFilter);
        }

        if (colStatusFilter !== 'all') {
            result = result.filter(u => u.status === colStatusFilter);
        }

        // 3. Sorting
        return result.sort((a, b) => {
            let valA: any = '';
            let valB: any = '';

            if (sortField === 'name') {
                valA = a.name || '';
                valB = b.name || '';
            } else if (sortField === 'contact') {
                valA = a.email || '';
                valB = b.email || '';
            } else if (sortField === 'role') {
                valA = a.role || '';
                valB = b.role || '';
            } else if (sortField === 'teacher') {
                const teacherA = teachers.find(t => t.id === a.teacher_id)?.name || 'ZUnassigned';
                const teacherB = teachers.find(t => t.id === b.teacher_id)?.name || 'ZUnassigned';
                valA = teacherA;
                valB = teacherB;
            } else if (sortField === 'classroom') {
                const cDataA = a.classroom_students?.[0]?.classrooms;
                const cNameA = Array.isArray(cDataA) ? (cDataA[0] as any)?.name : (cDataA as any)?.name;
                const cDataB = b.classroom_students?.[0]?.classrooms;
                const cNameB = Array.isArray(cDataB) ? (cDataB[0] as any)?.name : (cDataB as any)?.name;
                valA = cNameA || 'ZUnassigned';
                valB = cNameB || 'ZUnassigned';
            } else if (sortField === 'billing') {
                valA = a.fees_basis || '';
                valB = b.fees_basis || '';
            } else if (sortField === 'dueDate') {
                valA = a.fees_collection_date || 99;
                valB = b.fees_collection_date || 99;
            } else if (sortField === 'status') {
                valA = a.status || '';
                valB = b.status || '';
            }

            let comparison = 0;
            if (typeof valA === 'number' && typeof valB === 'number') {
                comparison = valA - valB;
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [
        usersList, activeTab, searchQuery, teachers, sortField, sortOrder,
        colUserFilter, colContactFilter, colRoleFilter, colTeacherFilter,
        colClassroomFilter, colBillingFilter, colDueDateFilter, colStatusFilter
    ]);

    const openAllocationModal = (user: UserProfile) => {
        setSelectedUser(user);
        setAllocatedRole(user.role === 'pending' ? 'student' : user.role);
        setSelectedTeacherId(user.teacher_id || '');
        
        const currentClassroom = user.classroom_students?.[0]?.classroom_id || '';
        setSelectedClassroomId(currentClassroom);
        setExperienceLevel(user.level || 'beginner');
        setLearningMode(user.learning_mode || 'online');
        const basis = user.fees_basis || 'monthly';
        setFeesBasis(basis);
        
        if (user.fees_amount !== null && user.fees_amount !== undefined && Number(user.fees_amount) > 0) {
            setFeesAmount(String(user.fees_amount));
        } else {
            setFeesAmount(basis === 'monthly' ? '2400' : '600');
        }
        
        if (user.fees_classes_paid !== null && user.fees_classes_paid !== undefined) {
            setFeesClassesPaid(String(user.fees_classes_paid));
        } else {
            setFeesClassesPaid('4');
        }
        
        const initialJoinDate = user.join_date || new Date().toISOString().split('T')[0];
        setJoinDate(initialJoinDate);
        
        const getDayFromDateString = (dateStr: string) => {
            const parts = dateStr.split('-');
            if (parts.length === 3) return String(Number(parts[2]));
            return String(new Date().getDate());
        };
        const joinDateDay = getDayFromDateString(initialJoinDate);
        setFeesCollectionDate(user.fees_collection_date ? String(user.fees_collection_date) : joinDateDay);
        
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
                learning_mode: isStudent ? learningMode : null,
                teacher_id: isStudent ? (selectedTeacherId || null) : null,
                fees_basis: isStudent ? feesBasis : null,
                fees_amount: isStudent ? (Number(feesAmount) || 0) : null,
                fees_classes_paid: isStudent ? (Number(feesClassesPaid) || 0) : null,
                fees_collection_date: isStudent ? (feesCollectionDate ? Number(feesCollectionDate) : null) : null,
                join_date: isStudent ? joinDate : null
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

    const renderSortHeader = (label: string, field: SortField) => {
        const isSorted = sortField === field;
        return (
            <button
                type="button"
                onClick={() => handleSort(field)}
                className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 font-black uppercase text-[10px] tracking-wider transition-colors text-left group"
                title={`Click to sort by ${label}`}
            >
                <span className={isSorted ? 'text-[#b45309] dark:text-[#ecb613]' : ''}>{label}</span>
                {isSorted ? (
                    sortOrder === 'asc' ? (
                        <ArrowUp className="size-3 text-[#b45309] dark:text-[#ecb613] shrink-0" />
                    ) : (
                        <ArrowDown className="size-3 text-[#b45309] dark:text-[#ecb613] shrink-0" />
                    )
                ) : (
                    <ArrowUpDown className="size-3 text-slate-300 dark:text-slate-600 opacity-60 group-hover:opacity-100 shrink-0" />
                )}
            </button>
        );
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

                <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
                    <TeacherHeader 
                        title="Role Allocation" 
                        avatarUrl={teacherProfile?.profile_pic_url}
                        userName={teacherProfile?.name}
                        backLink={teacherProfile?.role === 'admin' ? '/admin-dashboard' : '/teacher-dashboard'}
                    />

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12">
                        <div className="w-full space-y-8">
                            
                            {/* Header Section */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Registration approvals</h1>
                                    <p className="text-slate-550 dark:text-slate-400 mt-2.5">Review newly registered accounts and allocate portal roles, teachers, class batches, and fees parameters.</p>
                                </div>
                                <button
                                    onClick={() => {
                                        exportRoleAllocationCSV(usersList, teachers, classrooms, 'All_Roles_Report');
                                    }}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-[#ecb613] hover:bg-[#d9a40e] text-slate-950 font-black rounded-xl text-xs shadow-sm transition-all cursor-pointer border border-[#d9a40e] shrink-0 self-start sm:self-center"
                                    title="Export All Users (Students, Teachers, Admins, Mentors, Pending) to CSV File"
                                >
                                    <Download className="size-4" />
                                    <span>Export CSV Report</span>
                                </button>
                            </div>

                            {/* User Tab Filters */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                
                                {/* Filters Panel */}
                                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/40">
                                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-full md:w-auto overflow-x-auto scrollbar-none whitespace-nowrap snap-x">
                                        {[
                                            { id: 'pending', label: 'Pending approval', count: usersList.filter(u => u.role === 'pending' || u.status === 'pending').length },
                                            { id: 'mentors', label: 'Mentors & Pairing', count: usersList.filter(u => u.role === 'mentor').length },
                                            { id: 'teachers', label: 'Teachers', count: usersList.filter(u => u.role === 'teacher' && u.status !== 'pending').length },
                                            { id: 'students', label: 'Students', count: usersList.filter(u => u.role === 'student' && u.status !== 'pending').length },
                                            { id: 'admins', label: 'Admins', count: usersList.filter(u => u.role === 'admin' && u.status !== 'pending').length }
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id as any)}
                                                className={`px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 snap-start ${
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

                                    <div className="flex items-center gap-2 w-full md:w-auto">
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
                                        {hasActiveFilters && (
                                            <button
                                                onClick={clearAllFilters}
                                                className="px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/60 rounded-xl border border-rose-200 dark:border-rose-900/40 flex items-center gap-1 transition-all shrink-0"
                                                title="Reset all filters and sorting"
                                            >
                                                <X className="size-3.5" />
                                                <span className="hidden sm:inline">Reset</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {activeTab === 'mentors' ? (
                                    <div className="p-2">
                                        <TeacherMentorManagement />
                                    </div>
                                ) : (
                                    <>
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
                                                                    <div className="size-10 rounded-xl bg-[#ecb613]/10 text-[#ecb613] font-black flex items-center justify-center border border-slate-100 dark:border-slate-800 overflow-hidden shrink-0">
                                                                        {user.profile_pic_url ? (
                                                                            <img src={user.profile_pic_url} alt={user.name || user.email} className="w-full h-full object-cover" loading="lazy" />
                                                                        ) : (
                                                                            <span>{user.name?.charAt(0) || user.email?.charAt(0).toUpperCase()}</span>
                                                                        )}
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
                                                                        <span className="font-semibold text-slate-700 dark:text-slate-350">{teacherName}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Batch</span>
                                                                        <span className="font-semibold text-slate-700 dark:text-slate-350">{class_name}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
                                                            {(activeTab === 'students' || activeTab === 'pending') && (
                                                                <div className="grid grid-cols-2 gap-2 text-xs p-2 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg">
                                                                    <div>
                                                                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Billing Plan</span>
                                                                        <span className="font-semibold text-slate-700 dark:text-slate-350 text-[11px] capitalize">
                                                                            {user.fees_basis === 'monthly' ? 'Monthly' : user.fees_basis === 'class' ? 'Class-basis' : 'N/A'}
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block text-[9px] font-bold text-slate-400 uppercase">Due Date</span>
                                                                        <span className="font-semibold text-slate-700 dark:text-slate-350 text-[11px] whitespace-nowrap">
                                                                            {(() => {
                                                                                if (user.fees_basis === 'monthly') {
                                                                                    if (user.fees_collection_date) {
                                                                                        return `${user.fees_collection_date}th`;
                                                                                    }
                                                                                }
                                                                                return 'N/A';
                                                                            })()}
                                                                        </span>
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
                                                                        <button onClick={() => openAllocationModal(user)} className="px-3 py-1.5 text-xs font-bold bg-[#ecb613]/10 text-[#b45309] rounded-lg">
                                                                            Assign
                                                                        </button>
                                                                    )}
                                                                    <button onClick={() => openAllocationModal(user)} className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg">
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

                                        {/* Desktop Table View */}
                                        <div className="hidden lg:block overflow-x-auto min-h-[350px]">
                                            <table className="w-full border-collapse text-left">
                                                <thead>
                                                    {/* Column Headers with Sort Toggles */}
                                                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/60">
                                                        <th className="px-4 py-3 text-left whitespace-nowrap">
                                                            {renderSortHeader('User', 'name')}
                                                        </th>
                                                        <th className="px-4 py-3 text-left whitespace-nowrap">
                                                            {renderSortHeader('Contact Details', 'contact')}
                                                        </th>
                                                        <th className="px-4 py-3 text-left whitespace-nowrap">
                                                            {renderSortHeader('Current Role', 'role')}
                                                        </th>
                                                        {activeTab === 'students' && (
                                                            <>
                                                                <th className="px-4 py-3 text-left whitespace-nowrap">
                                                                    {renderSortHeader('Teacher', 'teacher')}
                                                                </th>
                                                                <th className="px-4 py-3 text-left whitespace-nowrap">
                                                                    {renderSortHeader('Batch Class', 'classroom')}
                                                                </th>
                                                            </>
                                                        )}
                                                        {(activeTab === 'students' || activeTab === 'pending') && (
                                                            <>
                                                                <th className="px-4 py-3 text-left whitespace-nowrap">
                                                                    {renderSortHeader('Billing Plan', 'billing')}
                                                                </th>
                                                                <th className="px-4 py-3 text-left whitespace-nowrap">
                                                                    {renderSortHeader('Due Date', 'dueDate')}
                                                                </th>
                                                            </>
                                                        )}
                                                        <th className="px-4 py-3 text-left whitespace-nowrap">
                                                            {renderSortHeader('Status', 'status')}
                                                        </th>
                                                        <th className="px-4 py-3 text-right whitespace-nowrap">
                                                            <span className="font-black uppercase text-[10px] tracking-wider text-slate-400 dark:text-slate-500">Actions</span>
                                                        </th>
                                                    </tr>

                                                    {/* Column Filters Bar */}
                                                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-850/60 text-xs">
                                                        {/* User Filter */}
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="text"
                                                                value={colUserFilter}
                                                                onChange={e => setColUserFilter(e.target.value)}
                                                                placeholder="Filter name/ID..."
                                                                className="w-full px-2 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-[#ecb613] transition-all placeholder:text-slate-400"
                                                            />
                                                        </td>

                                                        {/* Contact Filter */}
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="text"
                                                                value={colContactFilter}
                                                                onChange={e => setColContactFilter(e.target.value)}
                                                                placeholder="Filter email/phone..."
                                                                className="w-full px-2 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-[#ecb613] transition-all placeholder:text-slate-400"
                                                            />
                                                        </td>

                                                        {/* Role Filter */}
                                                        <td className="px-3 py-2">
                                                            <select
                                                                value={colRoleFilter}
                                                                onChange={e => setColRoleFilter(e.target.value)}
                                                                className="w-full px-2 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-[#ecb613] transition-all cursor-pointer"
                                                            >
                                                                <option value="all">All Roles</option>
                                                                <option value="student">Student</option>
                                                                <option value="teacher">Teacher</option>
                                                                <option value="admin">Admin</option>
                                                                <option value="pending">Pending</option>
                                                                <option value="mentor">Mentor</option>
                                                            </select>
                                                        </td>

                                                        {/* Student fields filters */}
                                                        {activeTab === 'students' && (
                                                            <>
                                                                {/* Teacher Filter */}
                                                                <td className="px-3 py-2">
                                                                    <select
                                                                        value={colTeacherFilter}
                                                                        onChange={e => setColTeacherFilter(e.target.value)}
                                                                        className="w-full px-2 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-[#ecb613] transition-all cursor-pointer"
                                                                    >
                                                                        <option value="all">All Teachers</option>
                                                                        <option value="unassigned">Unassigned</option>
                                                                        {teachers.map(t => (
                                                                            <option key={t.id} value={t.id}>{t.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </td>

                                                                {/* Classroom Filter */}
                                                                <td className="px-3 py-2">
                                                                    <select
                                                                        value={colClassroomFilter}
                                                                        onChange={e => setColClassroomFilter(e.target.value)}
                                                                        className="w-full px-2 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-[#ecb613] transition-all cursor-pointer"
                                                                    >
                                                                        <option value="all">All Batches</option>
                                                                        <option value="unassigned">Unassigned</option>
                                                                        {uniqueBatches.map(b => (
                                                                            <option key={b} value={b}>{b}</option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                            </>
                                                        )}

                                                        {(activeTab === 'students' || activeTab === 'pending') && (
                                                            <>
                                                                {/* Billing Plan Filter */}
                                                                <td className="px-3 py-2">
                                                                    <select
                                                                        value={colBillingFilter}
                                                                        onChange={e => setColBillingFilter(e.target.value)}
                                                                        className="w-full px-2 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-[#ecb613] transition-all cursor-pointer"
                                                                    >
                                                                        <option value="all">All Plans</option>
                                                                        <option value="monthly">Monthly</option>
                                                                        <option value="class">Class-basis</option>
                                                                        <option value="none">N/A</option>
                                                                    </select>
                                                                </td>

                                                                {/* Due Date Filter */}
                                                                <td className="px-3 py-2">
                                                                    <select
                                                                        value={colDueDateFilter}
                                                                        onChange={e => setColDueDateFilter(e.target.value)}
                                                                        className="w-full px-2 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-[#ecb613] transition-all cursor-pointer"
                                                                    >
                                                                        <option value="all">All Days</option>
                                                                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                                                            <option key={day} value={String(day)}>{day}th</option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                            </>
                                                        )}

                                                        {/* Status Filter */}
                                                        <td className="px-3 py-2">
                                                            <select
                                                                value={colStatusFilter}
                                                                onChange={e => setColStatusFilter(e.target.value)}
                                                                className="w-full px-2 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-[#ecb613] transition-all cursor-pointer"
                                                            >
                                                                <option value="all">All Statuses</option>
                                                                <option value="active">Approved</option>
                                                                <option value="pending">Pending</option>
                                                            </select>
                                                        </td>

                                                        {/* Clear Filters Button */}
                                                        <td className="px-3 py-2 text-right">
                                                            {hasActiveFilters && (
                                                                <button
                                                                    onClick={clearAllFilters}
                                                                    className="px-2 py-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-lg transition-colors inline-flex items-center gap-1 ml-auto"
                                                                    title="Clear all filters"
                                                                >
                                                                    <X className="size-3" />
                                                                    <span>Clear</span>
                                                                </button>
                                                            )}
                                                        </td>
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
                                                                    <td className="px-4 py-4 min-w-[180px]">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="size-8 rounded-xl bg-[#ecb613]/10 text-[#ecb613] font-black flex items-center justify-center border border-slate-100 dark:border-slate-800 overflow-hidden shrink-0">
                                                                                {user.profile_pic_url ? (
                                                                                    <img src={user.profile_pic_url} alt={user.name || user.email} className="w-full h-full object-cover" loading="lazy" />
                                                                                ) : (
                                                                                    <span>{user.name?.charAt(0) || user.email?.charAt(0).toUpperCase()}</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex flex-col min-w-0">
                                                                                <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug break-words">{user.name || 'Unassigned Name'}</p>
                                                                                <p className="text-[9px] font-mono font-bold text-slate-400 mt-0.5 uppercase tracking-wide">ID: {user.id.slice(0, 8)}</p>
                                                                            </div>
                                                                        </div>
                                                                    </td>

                                                                    {/* Contact Details */}
                                                                    <td className="px-4 py-4 min-w-[200px] space-y-0.5">
                                                                        <p className="text-xs text-slate-700 dark:text-slate-350 flex items-center gap-1.5 font-medium truncate" title={user.email}>
                                                                            <Mail className="size-3.5 text-slate-400 shrink-0" />
                                                                            <span className="truncate">{user.email}</span>
                                                                        </p>
                                                                        {user.phone && (
                                                                            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                                                                                <Phone className="size-3.5 text-slate-400 shrink-0" />
                                                                                <span>{user.phone}</span>
                                                                            </p>
                                                                        )}
                                                                    </td>

                                                                    {/* Current Role */}
                                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider inline-block whitespace-nowrap ${
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
                                                                            <td className="px-4 py-4 text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                                                                {teacherName}
                                                                            </td>
                                                                            <td className="px-4 py-4 text-xs font-extrabold text-[#b45309] dark:text-[#ecb613] min-w-[150px] leading-snug">
                                                                                {class_name}
                                                                            </td>
                                                                        </>
                                                                    )}
                                                                    {(activeTab === 'students' || activeTab === 'pending') && (
                                                                        <>
                                                                            <td className="px-4 py-4 text-xs font-semibold text-slate-650 dark:text-slate-350 capitalize whitespace-nowrap">
                                                                                {user.fees_basis === 'monthly' ? 'Monthly' : user.fees_basis === 'class' ? 'Class-basis' : 'N/A'}
                                                                            </td>
                                                                            <td className="px-4 py-4 text-xs font-semibold text-slate-650 dark:text-slate-350 whitespace-nowrap">
                                                                                {(() => {
                                                                                    if (user.fees_basis === 'monthly') {
                                                                                        if (user.fees_collection_date) {
                                                                                            return `${user.fees_collection_date}th of month`;
                                                                                        }
                                                                                    }
                                                                                    return 'N/A';
                                                                                })()}
                                                                            </td>
                                                                        </>
                                                                    )}

                                                                    {/* Status Badge */}
                                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
                                                                            user.status === 'active'
                                                                                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30'
                                                                                : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30'
                                                                        }`}>
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                                                                            {user.status === 'active' ? 'Approved' : 'Pending Approval'}
                                                                        </span>
                                                                    </td>

                                                                    {/* Actions */}
                                                                    <td className="px-4 py-4 text-right whitespace-nowrap">
                                                                        <div className="flex items-center justify-end gap-2">
                                                                            <button
                                                                                onClick={() => openAllocationModal(user)}
                                                                                className="px-3 py-1.5 text-xs font-black bg-[#ecb613] hover:bg-[#d49900] text-slate-950 rounded-xl shadow-xs transition-all active:scale-[0.97] inline-flex items-center gap-1.5 shrink-0"
                                                                            >
                                                                                <UserCheck className="size-3.5" />
                                                                                <span>{user.role === 'pending' ? 'Allocate' : 'Edit Allocation'}</span>
                                                                            </button>
                                                                            {user.role !== 'admin' && (
                                                                                <button
                                                                                    onClick={() => handleDeleteUser(user.id, user.name || user.email)}
                                                                                    className="p-1.5 border border-rose-200 dark:border-rose-900/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-450 rounded-lg transition-all shadow-xs shrink-0"
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
                                                            <td colSpan={activeTab === 'students' ? 8 : (activeTab === 'pending' ? 6 : 5)} className="px-6 py-12 text-center text-slate-400">
                                                                <ShieldCheck className="size-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                                                                <p className="text-sm font-semibold">No accounts found in this category.</p>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
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
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-[#ecb613]/10 text-[#ecb613] font-black flex items-center justify-center border border-slate-100 dark:border-slate-800 overflow-hidden shrink-0">
                                    {selectedUser.profile_pic_url ? (
                                        <img src={selectedUser.profile_pic_url} alt={selectedUser.name || selectedUser.email} className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{selectedUser.name?.charAt(0) || selectedUser.email?.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Allocate User Role</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Configuring permissions and credentials for {selectedUser.name || selectedUser.email}</p>
                                </div>
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
                                                onChange={e => {
                                                    const newClassroomId = e.target.value;
                                                    setSelectedClassroomId(newClassroomId);
                                                    const room = classrooms.find(c => c.id === newClassroomId);
                                                    if (room) {
                                                        setLearningMode(room.name.toLowerCase().includes('offline') ? 'offline' : 'online');
                                                    }
                                                }}
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

                                        {/* Learning Mode */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Learning Mode</label>
                                            <select
                                                value={learningMode}
                                                onChange={e => setLearningMode(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-[#ecb613]/25 outline-none font-semibold cursor-pointer"
                                            >
                                                <option value="online">Online</option>
                                                <option value="offline">Offline (In-Person)</option>
                                            </select>
                                        </div>

                                        {/* Fees Basis */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Billing Plan</label>
                                            <select
                                                value={feesBasis}
                                                onChange={e => {
                                                    const plan = e.target.value;
                                                    setFeesBasis(plan);
                                                    if (plan === 'monthly') {
                                                        setFeesAmount('2400');
                                                        setFeesClassesPaid('4');
                                                    } else if (plan === 'class') {
                                                        setFeesAmount('600');
                                                        setFeesClassesPaid('4');
                                                    }
                                                }}
                                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-[#ecb613]/25 outline-none font-semibold cursor-pointer"
                                            >
                                                <option value="monthly">Monthly Subscription</option>
                                                <option value="class">Class-basis (Advance Booking)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {/* Joining Date */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Joining Date</label>
                                            <input
                                                required={allocatedRole === 'student'}
                                                type="date"
                                                value={joinDate}
                                                onChange={e => {
                                                    const newDate = e.target.value;
                                                    setJoinDate(newDate);
                                                    const parts = newDate.split('-');
                                                    if (parts.length === 3) {
                                                        setFeesCollectionDate(String(Number(parts[2])));
                                                    }
                                                }}
                                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#ecb613]/25 outline-none font-bold"
                                            />
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
                                            {feesBasis === 'monthly' && (
                                                <div className="flex gap-1 mt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFeesAmount('2000')}
                                                        className={`px-1.5 py-0.5 text-[9px] font-black rounded border transition-colors ${
                                                            feesAmount === '2000'
                                                                ? 'bg-[#ecb613] text-white border-[#ecb613]'
                                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-350 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                                                        }`}
                                                    >
                                                        ₹2,000
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFeesAmount('2400')}
                                                        className={`px-1.5 py-0.5 text-[9px] font-black rounded border transition-colors ${
                                                            feesAmount === '2400'
                                                                ? 'bg-[#ecb613] text-white border-[#ecb613]'
                                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-350 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                                                        }`}
                                                    >
                                                        ₹2,400
                                                    </button>
                                                </div>
                                            )}
                                            {feesBasis === 'class' && (
                                                <div className="flex gap-1 mt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFeesAmount('600')}
                                                        className={`px-1.5 py-0.5 text-[9px] font-black rounded border transition-colors ${
                                                            feesAmount === '600'
                                                                ? 'bg-[#ecb613] text-white border-[#ecb613]'
                                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-350 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                                                        }`}
                                                    >
                                                        ₹600
                                                    </button>
                                                </div>
                                            )}
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
                                            {sortClassroomsByDayAndTime(classrooms).map(classroom => {
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
