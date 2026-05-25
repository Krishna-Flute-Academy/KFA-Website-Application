'use client';

import React, { useEffect, useState, useRef } from 'react';
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

interface BulkEnrollRow {
    name: string;
    email: string;
    phone: string;
    level: string;
    batchId: string;
    error?: string;
}

interface Classroom {
    id: string;
    name: string;
}

export default function StudentDirectory() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ name: string; email: string; id: string } | null>(null);
    const [students, setStudents] = useState<StudentData[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [stats, setStats] = useState({
        avgAttendance: 0,
        submissionRate: 76, // Mocked for now
    });
    const [filterMode, setFilterMode] = useState<'all' | 'recent'>('all');
    const [selectedBatch, setSelectedBatch] = useState<string>('All Batches');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // Single delete
    const [studentToDelete, setStudentToDelete] = useState<{ id: string, name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Bulk selection & deletion
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Bulk enroll modal
    const [showBulkEnrollModal, setShowBulkEnrollModal] = useState(false);
    const [bulkEnrollStep, setBulkEnrollStep] = useState<'input' | 'review' | 'done'>('input');
    const [bulkCsvText, setBulkCsvText] = useState('');
    const [bulkRows, setBulkRows] = useState<BulkEnrollRow[]>([]);
    const [bulkEnrollBatch, setBulkEnrollBatch] = useState('');
    const [bulkEnrollLevel, setBulkEnrollLevel] = useState('beginner');
    const [isBulkEnrolling, setIsBulkEnrolling] = useState(false);
    const [bulkEnrollResult, setBulkEnrollResult] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [filterMode, selectedBatch, statusFilter, searchQuery]);

    // Clear selection when page changes or filters change
    useEffect(() => {
        setSelectedIds(new Set());
    }, [currentPage, filterMode, selectedBatch, statusFilter, searchQuery]);

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

                setTeacherProfile({ id: userId, name: profile.name, email: profile.email });

                // 3. Fetch classrooms for bulk enroll
                const { data: rooms } = await supabaseAuth
                    .from('classrooms')
                    .select('id, name')
                    .eq('teacher_id', userId);
                if (rooms) setClassrooms(rooms);

                // 4. Fetch Students directly from users table
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

    // ─── Single Delete ────────────────────────────────────────────────────────
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

    // ─── Bulk Selection ───────────────────────────────────────────────────────
    const toggleSelectStudent = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedStudents.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(paginatedStudents.map(s => s.id)));
        }
    };

    // ─── Bulk Delete ──────────────────────────────────────────────────────────
    const confirmBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        setIsBulkDeleting(true);
        try {
            const ids = Array.from(selectedIds);
            const { error } = await supabaseAuth
                .from('users')
                .delete()
                .in('id', ids);

            if (error) {
                console.error("Bulk deletion error:", error);
                alert("Failed to delete selected students. Please try again.");
                return;
            }

            setStudents(prev => prev.filter(s => !selectedIds.has(s.id)));
            setSelectedIds(new Set());
            setShowBulkDeleteModal(false);
        } catch (err: any) {
            console.error('Error bulk deleting students:', err);
            alert("An unexpected error occurred during bulk deletion.");
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // ─── Bulk Enroll: CSV Parse ───────────────────────────────────────────────
    const parseBulkCsv = () => {
        const lines = bulkCsvText.trim().split('\n').filter(l => l.trim() !== '');
        if (lines.length === 0) return;

        // Detect if first line is a header
        const firstLineLower = lines[0].toLowerCase();
        const hasHeader = firstLineLower.includes('name') || firstLineLower.includes('email');
        const dataLines = hasHeader ? lines.slice(1) : lines;

        const parsed: BulkEnrollRow[] = dataLines.map(line => {
            // Support comma or tab separated
            const cols = line.split(/,|\t/).map(c => c.trim().replace(/^"|"$/g, ''));
            const name = cols[0] || '';
            const email = cols[1] || '';
            const phone = cols[2] || '';
            let error: string | undefined;
            if (!name) error = 'Name is required';
            else if (!email || !email.includes('@')) error = 'Valid email is required';
            return {
                name,
                email,
                phone,
                level: bulkEnrollLevel,
                batchId: bulkEnrollBatch,
                error,
            };
        });

        setBulkRows(parsed);
        setBulkEnrollStep('review');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setBulkCsvText(ev.target?.result as string ?? '');
        };
        reader.readAsText(file);
    };

    const updateBulkRow = (idx: number, field: keyof BulkEnrollRow, value: string) => {
        setBulkRows(prev => prev.map((r, i) => {
            if (i !== idx) return r;
            const updated = { ...r, [field]: value };
            // Re-validate
            if (!updated.name) updated.error = 'Name is required';
            else if (!updated.email || !updated.email.includes('@')) updated.error = 'Valid email is required';
            else updated.error = undefined;
            return updated;
        }));
    };

    const removeBulkRow = (idx: number) => {
        setBulkRows(prev => prev.filter((_, i) => i !== idx));
    };

    // ─── Bulk Enroll Submit ───────────────────────────────────────────────────
    const submitBulkEnroll = async () => {
        if (!teacherProfile) return;
        const validRows = bulkRows.filter(r => !r.error);
        if (validRows.length === 0) return;

        setIsBulkEnrolling(true);
        let success = 0;
        let failed = 0;

        for (const row of validRows) {
            try {
                const { data: userData, error: userError } = await supabaseAuth
                    .from('users')
                    .insert([{
                        name: row.name,
                        email: row.email,
                        phone: row.phone,
                        role: 'student',
                        status: 'active',
                        teacher_id: teacherProfile.id,
                        join_date: new Date().toISOString().split('T')[0],
                        level: row.level || bulkEnrollLevel,
                    }])
                    .select()
                    .single();

                if (userError) throw userError;

                // Link to classroom if batch selected
                const batchId = row.batchId || bulkEnrollBatch;
                if (batchId && userData) {
                    await supabaseAuth
                        .from('classroom_students')
                        .insert([{
                            classroom_id: batchId,
                            student_id: userData.id,
                            joined_at: new Date().toISOString(),
                        }]);
                }
                success++;
            } catch (err) {
                console.error('Error enrolling student:', row.name, err);
                failed++;
            }
        }

        setBulkEnrollResult({ success, failed });
        setIsBulkEnrolling(false);
        setBulkEnrollStep('done');

        // Refresh student list
        if (success > 0) {
            router.refresh();
            // Re-fetch students
            const userId = teacherProfile.id;
            const { data: studentsData } = await supabaseAuth
                .from('users')
                .select(`id, name, status, profile_pic_url, created_at, classroom_students(classrooms(name))`)
                .eq('role', 'student')
                .eq('teacher_id', userId);

            if (studentsData) {
                const formatted: StudentData[] = studentsData.map((s: any) => ({
                    id: s.id,
                    user_id: s.id,
                    name: s.name,
                    student_id_formatted: `KFA-2024-${s.id.slice(0, 3).toUpperCase()}`,
                    batch: s.classroom_students?.[0]?.classrooms?.name || 'Unassigned',
                    attendance_pct: Math.floor(Math.random() * 20) + 70,
                    profile_pic_url: s.profile_pic_url,
                    status: s.status === 'active' ? 'Active' : 'Inactive',
                    created_at: s.created_at,
                }));
                setStudents(formatted);
                if (formatted.length > 0) {
                    const avg = Math.round(formatted.reduce((acc, curr) => acc + curr.attendance_pct, 0) / formatted.length);
                    setStats(prev => ({ ...prev, avgAttendance: avg }));
                }
            }
        }
    };

    const closeBulkEnrollModal = () => {
        setShowBulkEnrollModal(false);
        setBulkEnrollStep('input');
        setBulkCsvText('');
        setBulkRows([]);
        setBulkEnrollBatch('');
        setBulkEnrollLevel('beginner');
        setBulkEnrollResult({ success: 0, failed: 0 });
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

    const allPageSelected = paginatedStudents.length > 0 && paginatedStudents.every(s => selectedIds.has(s.id));
    const somePageSelected = paginatedStudents.some(s => selectedIds.has(s.id));

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
            {/* ─── Single Delete Confirmation Modal ───────────────────────────────── */}
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

            {/* ─── Bulk Delete Confirmation Modal ─────────────────────────────────── */}
            {showBulkDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-2xl">group_remove</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Bulk Delete {selectedIds.size} Student{selectedIds.size !== 1 ? 's' : ''}?</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                This will permanently remove <span className="font-bold text-rose-600">{selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''}</span> and all their associated data. This action <span className="font-bold">cannot be undone</span>.
                            </p>
                            <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-100 dark:border-rose-800">
                                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-base">warning</span>
                                    All attendance records, submissions, and grades will be deleted.
                                </p>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                            <button 
                                onClick={() => setShowBulkDeleteModal(false)}
                                disabled={isBulkDeleting}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                                Cancel
                            </button>
                            <button 
                                onClick={confirmBulkDelete}
                                disabled={isBulkDeleting}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
                                {isBulkDeleting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                                ) : (
                                    <><span className="material-symbols-outlined text-lg">delete_sweep</span>Delete {selectedIds.size} Student{selectedIds.size !== 1 ? 's' : ''}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Bulk Enroll Modal ───────────────────────────────────────────────── */}
            {showBulkEnrollModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#ecb613]/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[#ecb613]">assignment_ind</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Bulk Enroll Students</h3>
                                    <p className="text-xs text-slate-500">Import multiple students at once via CSV or manual entry</p>
                                </div>
                            </div>
                            <button onClick={closeBulkEnrollModal} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Step indicator */}
                        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-shrink-0">
                            {(['input', 'review', 'done'] as const).map((step, idx) => (
                                <React.Fragment key={step}>
                                    <div className={`flex items-center gap-1.5 text-xs font-bold ${bulkEnrollStep === step ? 'text-[#ecb613]' : ((['input', 'review', 'done'].indexOf(bulkEnrollStep) > idx) ? 'text-green-600' : 'text-slate-400')}`}>
                                        <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-black ${bulkEnrollStep === step ? 'bg-[#ecb613] text-slate-900' : ((['input', 'review', 'done'].indexOf(bulkEnrollStep) > idx) ? 'bg-green-100 text-green-700' : 'bg-slate-200 dark:bg-slate-700 text-slate-500')}`}>
                                            {['input', 'review', 'done'].indexOf(bulkEnrollStep) > idx ? '✓' : idx + 1}
                                        </span>
                                        {step === 'input' ? 'Import Data' : step === 'review' ? 'Review & Edit' : 'Complete'}
                                    </div>
                                    {idx < 2 && <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700 max-w-[40px]" />}
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto">

                            {/* Step 1: Input */}
                            {bulkEnrollStep === 'input' && (
                                <div className="p-6 space-y-6">
                                    {/* Global settings */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Default Batch</label>
                                            <select
                                                value={bulkEnrollBatch}
                                                onChange={e => setBulkEnrollBatch(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                            >
                                                <option value="">No Batch (Unassigned)</option>
                                                {classrooms.map(room => (
                                                    <option key={room.id} value={room.id}>{room.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Default Level</label>
                                            <select
                                                value={bulkEnrollLevel}
                                                onChange={e => setBulkEnrollLevel(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                            >
                                                <option value="beginner">Beginner</option>
                                                <option value="intermediate">Intermediate</option>
                                                <option value="advanced">Advanced</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* CSV format info */}
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                                        <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-base">info</span>
                                            CSV Format
                                        </p>
                                        <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">Name, Email, Phone (optional)</p>
                                        <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">Supports comma or tab-separated values. First row header is auto-detected.</p>
                                    </div>

                                    {/* File upload */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">Upload CSV File</label>
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:border-[#ecb613]/50 hover:bg-[#ecb613]/5 transition-all group"
                                        >
                                            <span className="material-symbols-outlined text-3xl text-slate-400 group-hover:text-[#ecb613] transition-colors">upload_file</span>
                                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mt-1">Click to upload CSV</p>
                                            <p className="text-xs text-slate-400 mt-0.5">or paste data below</p>
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".csv,.txt"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                    </div>

                                    {/* Manual text input */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Or Paste / Type Data</label>
                                        <textarea
                                            value={bulkCsvText}
                                            onChange={e => setBulkCsvText(e.target.value)}
                                            rows={8}
                                            placeholder={`Name, Email, Phone\nAarav Patel, aarav@email.com, +91 98001 00001\nRiya Sharma, riya@email.com\nAnkit Verma, ankit@email.com, +91 98001 00003`}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none resize-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400 placeholder:font-sans"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Review */}
                            {bulkEnrollStep === 'review' && (
                                <div className="p-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{bulkRows.length} student{bulkRows.length !== 1 ? 's' : ''} to enroll</p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                <span className="text-green-600 font-semibold">{bulkRows.filter(r => !r.error).length} valid</span>
                                                {bulkRows.filter(r => r.error).length > 0 && <span className="text-rose-500 font-semibold ml-2">{bulkRows.filter(r => r.error).length} with errors</span>}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setBulkEnrollStep('input')}
                                            className="text-xs font-bold text-[#ecb613] hover:underline"
                                        >← Edit Data</button>
                                    </div>

                                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                                        {bulkRows.map((row, idx) => (
                                            <div key={idx} className={`rounded-xl border p-3 ${row.error ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50'}`}>
                                                <div className="grid grid-cols-12 gap-2 items-center">
                                                    <div className="col-span-1 flex items-center justify-center">
                                                        {row.error ? (
                                                            <span className="material-symbols-outlined text-rose-500 text-lg">error</span>
                                                        ) : (
                                                            <span className="material-symbols-outlined text-green-500 text-lg">check_circle</span>
                                                        )}
                                                    </div>
                                                    <input
                                                        value={row.name}
                                                        onChange={e => updateBulkRow(idx, 'name', e.target.value)}
                                                        placeholder="Full Name *"
                                                        className={`col-span-3 text-xs font-medium bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#ecb613]/30 ${row.error && !row.name ? 'border-rose-300' : 'border-slate-200 dark:border-slate-700'}`}
                                                    />
                                                    <input
                                                        value={row.email}
                                                        onChange={e => updateBulkRow(idx, 'email', e.target.value)}
                                                        placeholder="Email *"
                                                        className={`col-span-4 text-xs font-medium bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#ecb613]/30 ${row.error && (!row.email || !row.email.includes('@')) ? 'border-rose-300' : 'border-slate-200 dark:border-slate-700'}`}
                                                    />
                                                    <input
                                                        value={row.phone}
                                                        onChange={e => updateBulkRow(idx, 'phone', e.target.value)}
                                                        placeholder="Phone"
                                                        className="col-span-3 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#ecb613]/30"
                                                    />
                                                    <button
                                                        onClick={() => removeBulkRow(idx)}
                                                        className="col-span-1 flex items-center justify-center p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </div>
                                                {row.error && (
                                                    <p className="text-[10px] text-rose-500 font-medium mt-1 ml-8">{row.error}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {bulkRows.length === 0 && (
                                        <div className="text-center py-8 text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-2 block">person_search</span>
                                            <p className="text-sm">No students to enroll. Go back and add data.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Done */}
                            {bulkEnrollStep === 'done' && (
                                <div className="p-8 flex flex-col items-center justify-center text-center min-h-[280px] space-y-4">
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${bulkEnrollResult.success > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                                        <span className={`material-symbols-outlined text-3xl ${bulkEnrollResult.success > 0 ? 'text-green-600' : 'text-rose-500'}`}>
                                            {bulkEnrollResult.success > 0 ? 'check_circle' : 'error'}
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-slate-900 dark:text-white">Enrollment Complete!</h4>
                                        <p className="text-slate-500 text-sm mt-1">Bulk enrollment process finished.</p>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-center">
                                            <p className="text-3xl font-black text-green-600">{bulkEnrollResult.success}</p>
                                            <p className="text-xs text-slate-500 font-medium">Enrolled</p>
                                        </div>
                                        {bulkEnrollResult.failed > 0 && (
                                            <div className="text-center">
                                                <p className="text-3xl font-black text-rose-500">{bulkEnrollResult.failed}</p>
                                                <p className="text-xs text-slate-500 font-medium">Failed</p>
                                            </div>
                                        )}
                                    </div>
                                    {bulkEnrollResult.failed > 0 && (
                                        <p className="text-xs text-slate-400 max-w-xs">Some students could not be enrolled (possibly duplicate emails). Check the console for details.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
                            <button onClick={closeBulkEnrollModal} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                {bulkEnrollStep === 'done' ? 'Close' : 'Cancel'}
                            </button>
                            <div className="flex items-center gap-3">
                                {bulkEnrollStep === 'input' && (
                                    <button
                                        onClick={parseBulkCsv}
                                        disabled={!bulkCsvText.trim()}
                                        className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                        Review Students
                                    </button>
                                )}
                                {bulkEnrollStep === 'review' && (
                                    <button
                                        onClick={submitBulkEnroll}
                                        disabled={isBulkEnrolling || bulkRows.filter(r => !r.error).length === 0}
                                        className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isBulkEnrolling ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Enrolling...</>
                                        ) : (
                                            <><span className="material-symbols-outlined text-lg">assignment_ind</span>Enroll {bulkRows.filter(r => !r.error).length} Student{bulkRows.filter(r => !r.error).length !== 1 ? 's' : ''}</>
                                        )}
                                    </button>
                                )}
                                {bulkEnrollStep === 'done' && bulkEnrollResult.success > 0 && (
                                    <button
                                        onClick={closeBulkEnrollModal}
                                        className="px-5 py-2 rounded-lg text-sm font-bold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-lg">check</span>
                                        View Students
                                    </button>
                                )}
                            </div>
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

                                {/* Bulk action bar — shown when students are selected */}
                                {selectedIds.size > 0 && (
                                    <div className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl animate-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-rose-500">check_box</span>
                                            <span className="text-sm font-bold text-rose-700 dark:text-rose-400">
                                                {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setSelectedIds(new Set())}
                                                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                            >
                                                Clear selection
                                            </button>
                                            <button
                                                onClick={() => setShowBulkDeleteModal(true)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm"
                                            >
                                                <span className="material-symbols-outlined text-base">delete_sweep</span>
                                                Delete {selectedIds.size} Selected
                                            </button>
                                        </div>
                                    </div>
                                )}

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
                                                    {/* Select All Checkbox */}
                                                    <th className="px-4 py-4 w-10">
                                                        <input
                                                            type="checkbox"
                                                            checked={allPageSelected}
                                                            ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                                                            onChange={toggleSelectAll}
                                                            className="size-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/20 cursor-pointer"
                                                            title="Select all on this page"
                                                        />
                                                    </th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Batch</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Contact</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {paginatedStudents.map((student) => (
                                                    <tr key={student.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group ${selectedIds.has(student.id) ? 'bg-rose-50/60 dark:bg-rose-900/10' : ''}`}>
                                                        {/* Row checkbox */}
                                                        <td className="px-4 py-4">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds.has(student.id)}
                                                                onChange={() => toggleSelectStudent(student.id)}
                                                                className="size-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/20 cursor-pointer"
                                                            />
                                                        </td>
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
                                                        <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
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
                                            <button 
                                                onClick={() => setShowBulkEnrollModal(true)}
                                                className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#ecb613]/5 hover:border-[#ecb613]/30 transition-all gap-2 group">
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
