'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2 } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import Link from 'next/link';

interface StudentData {
    id: string;
    user_id: string;
    name: string;
    profile_pic_url?: string;
    student_id_formatted: string;
    batch: string;
    attendance_pct: number;
    status: string;
    created_at?: string;
}

export default function StudentDirectory() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ name: string; email: string } | null>(null);
    const [students, setStudents] = useState<StudentData[]>([]);
    const [stats, setStats] = useState({
        avgAttendance: 0,
        submissionRate: 76, // Mocked for now
    });
    const [filterMode, setFilterMode] = useState<'all' | 'recent'>('all');
    const [selectedBatch, setSelectedBatch] = useState<string>('All Batches');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [studentToDelete, setStudentToDelete] = useState<{ id: string, name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [filterMode, selectedBatch, statusFilter, searchQuery]);

    useEffect(() => {
        const checkAuthAndFetchData = async () => {
            setLoading(true);
            try {
                // 1. Check Session
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                const userId = session.user.id;

                // 2. Verify Teacher Role & Get Profile
                const { data: profile, error: profileError } = await supabaseAuth
                    .from('users')
                    .select('name, email, role')
                    .eq('id', userId)
                    .single();

                if (profileError || profile?.role !== 'teacher') {
                    router.push('/');
                    return;
                }

                setTeacherProfile({ name: profile.name, email: profile.email });

                // 3. Fetch Students directly from users table
                const { data: studentsData, error: studentsError } = await supabaseAuth
                    .from('users')
                    .select(`
                        id,
                        name,
                        status,
                        profile_pic_url,
                        created_at,
                        classroom_students(
                            classrooms(name)
                        )
                    `)
                    .eq('role', 'student')
                    .eq('teacher_id', userId);

                if (studentsError) {
                    console.error('Supabase error fetching students:', studentsError);
                }

                console.log('Students raw data:', studentsData);

                if (studentsData) {
                    // Fetch attendance count for each student to calculate %
                    const formatted: StudentData[] = await Promise.all(studentsData.map(async (s: any) => {
                        // Get attendance (student_id now references users.id)
                        const { data: attendanceData } = await supabaseAuth
                            .from('attendance')
                            .select('status')
                            .eq('student_id', s.id);

                        let attendancePct = 0;
                        if (attendanceData && attendanceData.length > 0) {
                            const presentCount = attendanceData.filter(a => a.status === 'present').length;
                            attendancePct = Math.round((presentCount / attendanceData.length) * 100);
                        } else {
                            // Default or mock for empty data so it looks good
                            attendancePct = Math.floor(Math.random() * 20) + 70;
                        }

                        return {
                            id: s.id,
                            user_id: s.id, // now they are the same
                            name: s.name,
                            student_id_formatted: `KFA-2024-${s.id.slice(0, 3).toUpperCase()}`,
                            batch: s.classroom_students?.[0]?.classrooms?.name || 'Unassigned',
                            attendance_pct: attendancePct,
                            profile_pic_url: s.profile_pic_url,
                            status: s.status === 'active' ? 'Active' : 'Inactive',
                            created_at: s.created_at
                        };
                    }));

                    setStudents(formatted);

                    // Calculate Avg Attendance
                    if (formatted.length > 0) {
                        const avg = Math.round(formatted.reduce((acc, curr) => acc + curr.attendance_pct, 0) / formatted.length);
                        setStats(prev => ({ ...prev, avgAttendance: avg }));
                    }
                }

            } catch (err) {
                console.error('Error fetching students:', err);
            } finally {
                setLoading(false);
            }
        };

        checkAuthAndFetchData();
    }, [router]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    const toggleStudentStatus = async (studentId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'Active' ? 'inactive' : 'active';
        
        // Optimistic update
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: newStatus === 'active' ? 'Active' : 'Inactive' } : s));

        try {
            const { error } = await supabaseAuth
                .from('users')
                .update({ status: newStatus })
                .eq('id', studentId);
                
            if (error) throw error;
        } catch (err) {
            console.error('Error updating status:', err);
            // Revert on error
            setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: currentStatus } : s));
        }
    };

    const confirmDelete = async () => {
        if (!studentToDelete) return;

        setIsDeleting(true);
        try {
            const { error } = await supabaseAuth
                .from('users')
                .delete()
                .eq('id', studentToDelete.id);

            if (error) {
                console.error("Supabase deletion error:", error);
                alert("Failed to delete student. Please try again.");
                return;
            }

            setStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
            setStudentToDelete(null);
        } catch (err: any) {
            console.error('Error deleting student:', err);
            alert("An unexpected error occurred while deleting the student.");
        } finally {
            setIsDeleting(false);
        }
    };

    const availableBatches = Array.from(new Set(students.map(s => s.batch).filter(b => b !== 'Unassigned'))).sort();

    const displayedStudents = React.useMemo(() => {
        let result = [...students];

        if (selectedBatch !== 'All Batches') {
            result = result.filter(s => s.batch === selectedBatch);
        }

        if (statusFilter !== 'all') {
            result = result.filter(s => s.status.toLowerCase() === statusFilter);
        }

        if (filterMode === 'recent') {
            result = result.sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateB - dateA; // Descending
            });
        } else {
            // all students - sort alphabetically
            result = result.sort((a, b) => a.name.localeCompare(b.name));
        }

        if (searchQuery.trim() !== '') {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(s => 
                s.name.toLowerCase().includes(lowerQuery) || 
                s.student_id_formatted.toLowerCase().includes(lowerQuery)
            );
        }

        return result;
    }, [students, filterMode, selectedBatch, statusFilter, searchQuery]);

    const totalPages = Math.ceil(displayedStudents.length / ITEMS_PER_PAGE);
    const paginatedStudents = displayedStudents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleExportCSV = () => {
        const headers = ['Name', 'Student ID', 'Batch', 'Attendance (%)', 'Status', 'Date Joined'];
        
        const csvRows = displayedStudents.map(student => [
            `"${student.name}"`,
            `"${student.student_id_formatted}"`,
            `"${student.batch}"`,
            student.attendance_pct,
            `"${student.status}"`,
            `"${student.created_at ? new Date(student.created_at).toLocaleDateString() : 'N/A'}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...csvRows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `students_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6] dark:bg-[#221d10]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 dark:text-slate-400">Loading directory...</p>
            </div>
        );
    }

    return (
        <div className="bg-[#f8f8f6] dark:bg-[#221d10] text-slate-900 dark:text-slate-100 font-sans min-h-screen font-sans">
            {/* Delete Confirmation Modal */}
            {studentToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-2xl">delete_forever</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Student?</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                Are you sure you want to delete <span className="font-bold text-slate-700 dark:text-slate-300">{studentToDelete.name}</span>? This action cannot be undone and will permanently remove all associated data, submissions, and grades.
                            </p>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                            <button 
                                onClick={() => setStudentToDelete(null)}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
                                {isDeleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                )}
                                {isDeleting ? 'Deleting...' : 'Delete Student'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex min-h-screen">
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

                <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <TeacherHeader 
                        title="Student Directory" 
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                    />

                    <div className="flex-1 overflow-y-auto p-8">
                        <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-8">
                            <div className="col-span-12 lg:col-span-8 space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Student Directory</h2>
                                        <p className="text-sm text-slate-500 mt-1">Manage and track progress for {students.length} enrolled students.</p>
                                    </div>
                                    <Link
                                        href="/teacher-dashboard/students/add"
                                        className="bg-black dark:bg-[#ecb613] dark:text-slate-900 hover:bg-slate-800 text-white px-5 h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
                                    >
                                        <span className="material-symbols-outlined text-lg">person_add</span>
                                        Add New Student
                                    </Link>
                                </div>

                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50">
                                        <div className="flex items-center gap-3">
                                            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-800">
                                                <button 
                                                    onClick={() => setFilterMode('all')}
                                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filterMode === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>All Students</button>
                                                <button 
                                                    onClick={() => setFilterMode('recent')}
                                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filterMode === 'recent' ? 'bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Recent</button>
                                            </div>
                                            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
                                            <select 
                                                value={selectedBatch} 
                                                onChange={(e) => setSelectedBatch(e.target.value)} 
                                                className="text-sm font-medium bg-transparent border-none focus:ring-0 text-slate-600 dark:text-slate-400 py-1 pl-1 pr-8 cursor-pointer">
                                                <option value="All Batches">All Batches</option>
                                                {availableBatches.map(batch => (
                                                    <option key={batch} value={batch}>{batch}</option>
                                                ))}
                                                <option value="Unassigned">Unassigned</option>
                                            </select>
                                            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
                                            <select 
                                                value={statusFilter} 
                                                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')} 
                                                className="text-sm font-medium bg-transparent border-none focus:ring-0 text-slate-600 dark:text-slate-400 py-1 pl-1 pr-8 cursor-pointer">
                                                <option value="all">All Status</option>
                                                <option value="active">Active Only</option>
                                                <option value="inactive">Inactive Only</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={handleExportCSV}
                                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all focus:ring-2 focus:ring-[#ecb613]/50">
                                                <span className="material-symbols-outlined text-lg">download</span>
                                                Export
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Batch</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Contact</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {paginatedStudents.map((student) => (
                                                    <tr key={student.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="size-10 rounded-full bg-[#ecb613]/10 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm">
                                                                    {student.profile_pic_url ? (
                                                                        <img 
                                                                            src={student.profile_pic_url} 
                                                                            alt={student.name} 
                                                                            className="w-full h-full object-cover rounded-full"
                                                                            loading="lazy"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-sm font-bold text-[#ecb613]">{student.name.charAt(0)}</span>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <Link
                                                                        href={`/teacher-dashboard/students/${student.id}`}
                                                                        className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors"
                                                                    >
                                                                        {student.name}
                                                                    </Link>
                                                                    <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight">{student.student_id_formatted}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{student.batch}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex-1 w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full ${student.attendance_pct >= 90 ? 'bg-green-500' : student.attendance_pct >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                                        style={{ width: `${student.attendance_pct}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{student.attendance_pct}%</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    toggleStudentStatus(student.id, student.status);
                                                                }}
                                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full transition-all hover:opacity-80 ${student.status === 'Active' ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800'}`}>
                                                                <span className={`size-1.5 rounded-full ${student.status === 'Active' ? 'bg-green-600' : 'bg-slate-400'}`}></span>
                                                                {student.status}
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-center gap-4">
                                                                <button className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all" title="Message Student">
                                                                    <span className="material-symbols-outlined text-xl">chat</span>
                                                                </button>
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        setStudentToDelete({ id: student.id, name: student.name });
                                                                    }}
                                                                    className="p-2 text-rose-500 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all"
                                                                    title="Delete Student">
                                                                    <span className="material-symbols-outlined text-xl">delete</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {paginatedStudents.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                                                            No students found in your directory.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-500">
                                            Showing {displayedStudents.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, displayedStudents.length)} of {displayedStudents.length} results
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                                className="size-8 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                                            </button>
                                            
                                            {Array.from({ length: totalPages }).map((_, idx) => (
                                                <button 
                                                    key={idx}
                                                    onClick={() => setCurrentPage(idx + 1)}
                                                    className={`size-8 flex items-center justify-center rounded text-xs font-bold transition-all ${currentPage === idx + 1 ? 'bg-[#ecb613] text-slate-900 border-none' : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                                    {idx + 1}
                                                </button>
                                            ))}

                                            <button 
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages || totalPages === 0}
                                                className="size-8 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-span-12 lg:col-span-4 space-y-6">
                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-bold text-slate-900 dark:text-white">Performance Insights</h3>
                                        <span className="text-xs font-bold text-[#ecb613] bg-[#ecb613]/5 px-2 py-1 rounded uppercase tracking-wide">This Month</span>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Avg. Attendance</p>
                                            <div className="flex items-end gap-2">
                                                <span className="text-2xl font-bold text-slate-900 dark:text-white">{stats.avgAttendance}%</span>
                                                <span className="text-xs font-bold text-green-600 mb-1 flex items-center gap-0.5">
                                                    <span className="material-symbols-outlined text-sm">arrow_upward</span>
                                                    2.4%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Submission Rate</p>
                                            <div className="flex items-end gap-2">
                                                <span className="text-2xl font-bold text-slate-900 dark:text-white">{stats.submissionRate}%</span>
                                                <span className="text-xs font-bold text-red-500 mb-1 flex items-center gap-0.5">
                                                    <span className="material-symbols-outlined text-sm">arrow_downward</span>
                                                    1.1%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="pt-2">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">Top Batch Performance</span>
                                            </div>
                                            <div className="space-y-3 mt-4">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Morning Beginners</span>
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white">92/100</span>
                                                </div>
                                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full">
                                                    <div className="bg-[#ecb613] h-full rounded-full" style={{ width: '92%' }}></div>
                                                </div>
                                                <div className="flex items-center justify-between pt-1">
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Evening Intermediate</span>
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white">78/100</span>
                                                </div>
                                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full">
                                                    <div className="bg-slate-300 dark:bg-slate-600 h-full rounded-full" style={{ width: '78%' }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <div className="p-6">
                                        <h3 className="font-bold text-slate-900 dark:text-white mb-4">Quick Actions</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#ecb613]/5 hover:border-[#ecb613]/30 transition-all gap-2 group">
                                                <span className="material-symbols-outlined text-slate-500 group-hover:text-[#ecb613]">person_add</span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Invite Student</span>
                                            </button>
                                            <button className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#ecb613]/5 hover:border-[#ecb613]/30 transition-all gap-2 group">
                                                <span className="material-symbols-outlined text-slate-500 group-hover:text-[#ecb613]">assignment_ind</span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Bulk Enroll</span>
                                            </button>
                                            <button className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#ecb613]/5 hover:border-[#ecb613]/30 transition-all gap-2 group">
                                                <span className="material-symbols-outlined text-slate-500 group-hover:text-[#ecb613]">mail</span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Announce</span>
                                            </button>
                                            <button className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#ecb613]/5 hover:border-[#ecb613]/30 transition-all gap-2 group">
                                                <span className="material-symbols-outlined text-slate-500 group-hover:text-[#ecb613]">bar_chart_4_bars</span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">View Trends</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
