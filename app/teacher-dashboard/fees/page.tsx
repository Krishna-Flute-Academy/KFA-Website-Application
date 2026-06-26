'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, Plus, Calendar, DollarSign, Users, AlertTriangle, ShieldCheck, Mail, History, Send, Check } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';

interface StudentFeesData {
    id: string;
    name: string;
    email: string;
    phone: string;
    profile_pic_url?: string;
    join_date: string;
    fees_basis: 'monthly' | 'class';
    fees_amount: number;
    fees_collection_date: string | null;
    fees_classes_paid: number;
    batch_name: string;
}

interface PaymentRecord {
    id: string;
    student_id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    classes_added: number;
    notes: string | null;
    created_at: string;
}

interface NotificationRecord {
    id: string;
    student_id: string;
    notification_type: string;
    sent_at: string;
    channel: string;
    status: string;
}

export default function FeesManagementDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);
    const [students, setStudents] = useState<StudentFeesData[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    
    // UI Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'good' | 'due_date' | 'due_classes' | 'overdue'>('all');
    const [basisFilter, setBasisFilter] = useState<'all' | 'monthly' | 'class'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 8;

    // Modals
    const [selectedStudent, setSelectedStudent] = useState<StudentFeesData | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [studentPayments, setStudentPayments] = useState<PaymentRecord[]>([]);
    const [studentNotifications, setStudentNotifications] = useState<NotificationRecord[]>([]);

    // Payment Form State
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('UPI');
    const [classesAdded, setClassesAdded] = useState('4');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [nextDueDate, setNextDueDate] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [recordingPayment, setRecordingPayment] = useState(false);

    // Toast/Alert
    const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (alertMessage) {
            const timer = setTimeout(() => setAlertMessage(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [alertMessage]);

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

            // 3. Fetch Students with Fees columns
            const { data: studentsData, error: studentsError } = await supabaseAuth
                .from('users')
                .select(`
                    id,
                    name,
                    email,
                    phone,
                    join_date,
                    fees_basis,
                    fees_amount,
                    fees_collection_date,
                    fees_classes_paid,
                    profile_pic_url,
                    classroom_students(
                        classrooms(name)
                    )
                `)
                .eq('role', 'student')
                .eq('teacher_id', userId);

            if (studentsError) throw studentsError;

            if (studentsData) {
                const formatted: StudentFeesData[] = studentsData.map((s: any) => {
                    const studentClassroomRef = s.classroom_students?.[0] as any;
                    const studentClassroom = studentClassroomRef?.classrooms;
                    const batch_name = Array.isArray(studentClassroom) 
                        ? studentClassroom[0]?.name 
                        : studentClassroom?.name;

                    return {
                        id: s.id,
                        name: s.name,
                        email: s.email || '',
                        phone: s.phone || '',
                        profile_pic_url: s.profile_pic_url,
                        join_date: s.join_date || s.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                        fees_basis: s.fees_basis || 'monthly',
                        fees_amount: Number(s.fees_amount) || 0,
                        fees_collection_date: s.fees_collection_date,
                        fees_classes_paid: Number(s.fees_classes_paid) || 0,
                        batch_name: batch_name || 'Unassigned'
                    };
                });
                setStudents(formatted);
            }

            // 4. Fetch Payments for current month stats
            const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
            const { data: paymentsData } = await supabaseAuth
                .from('fees_payments')
                .select(`
                    id,
                    student_id,
                    amount,
                    payment_date,
                    payment_method,
                    classes_added,
                    notes,
                    created_at,
                    users!inner(teacher_id)
                `)
                .eq('users.teacher_id', userId)
                .gte('payment_date', startOfMonth);

            if (paymentsData) {
                setPayments(paymentsData as any);
            }

        } catch (err) {
            console.error('Error fetching fees dashboard data:', err);
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

    // Calculate student payment status
    const getStudentStatus = (student: StudentFeesData) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const dateIsDue = student.fees_collection_date && student.fees_collection_date <= todayStr;
        const classesCompleted = student.fees_classes_paid <= 0;

        if (dateIsDue && classesCompleted) {
            return 'overdue';
        } else if (classesCompleted) {
            return 'due_classes';
        } else if (dateIsDue) {
            return 'due_date';
        } else {
            return 'good';
        }
    };

    // Filtering logic
    const filteredStudents = useMemo(() => {
        let result = [...students];

        if (searchQuery.trim() !== '') {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(s => s.name.toLowerCase().includes(lowerQuery));
        }

        if (basisFilter !== 'all') {
            result = result.filter(s => s.fees_basis === basisFilter);
        }

        if (statusFilter !== 'all') {
            result = result.filter(s => getStudentStatus(s) === statusFilter);
        }

        // Sort by status severity, then name
        const statusPriority = { overdue: 0, due_classes: 1, due_date: 2, good: 3 };
        return result.sort((a, b) => {
            const pA = statusPriority[getStudentStatus(a)];
            const pB = statusPriority[getStudentStatus(b)];
            if (pA !== pB) return pA - pB;
            return a.name.localeCompare(b.name);
        });
    }, [students, searchQuery, statusFilter, basisFilter]);

    // Pagination
    const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
    const paginatedStudents = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredStudents.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredStudents, currentPage]);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, basisFilter]);

    // Statistics
    const statsSummary = useMemo(() => {
        const totalCollected = payments.reduce((acc, curr) => acc + Number(curr.amount), 0);
        let overdueCount = 0;
        let dueClassesCount = 0;
        let dueDateCount = 0;
        let goodCount = 0;

        students.forEach(s => {
            const status = getStudentStatus(s);
            if (status === 'overdue') overdueCount++;
            else if (status === 'due_classes') dueClassesCount++;
            else if (status === 'due_date') dueDateCount++;
            else goodCount++;
        });

        return {
            totalCollected,
            overdueCount,
            dueClassesCount,
            dueDateCount,
            goodCount,
            totalStudents: students.length
        };
    }, [students, payments]);

    // Open Payment Modal
    const openPaymentModal = (student: StudentFeesData) => {
        setSelectedStudent(student);
        setPaymentAmount(String(student.fees_amount));
        setPaymentMethod('UPI');
        setClassesAdded(student.fees_basis === 'monthly' ? '4' : '5');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        
        // Calculate default next due date (+30 days)
        const d = new Date();
        d.setDate(d.getDate() + 30);
        setNextDueDate(d.toISOString().split('T')[0]);
        setPaymentNotes('');
        setShowPaymentModal(true);
    };

    // Auto update next due date when payment date changes
    const handlePaymentDateChange = (dateVal: string) => {
        setPaymentDate(dateVal);
        if (selectedStudent?.fees_basis === 'monthly') {
            const d = new Date(dateVal);
            d.setDate(d.getDate() + 30);
            setNextDueDate(d.toISOString().split('T')[0]);
        }
    };

    // Record Payment
    const handleRecordPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudent || !teacherProfile) return;

        setRecordingPayment(true);
        try {
            const amt = Number(paymentAmount) || 0;
            const cls = Number(classesAdded) || 0;

            // 1. Insert Payment Record
            const { error: paymentError } = await supabaseAuth
                .from('fees_payments')
                .insert([{
                    student_id: selectedStudent.id,
                    amount: amt,
                    payment_date: paymentDate,
                    payment_method: paymentMethod,
                    classes_added: cls,
                    notes: paymentNotes || null
                }]);

            if (paymentError) throw paymentError;

            // 2. Update Student User values
            // Add classes to remaining classes balance
            const newClassesPaid = selectedStudent.fees_classes_paid + cls;
            const { error: studentUpdateError } = await supabaseAuth
                .from('users')
                .update({
                    fees_amount: amt,
                    fees_collection_date: nextDueDate || null,
                    fees_classes_paid: newClassesPaid
                })
                .eq('id', selectedStudent.id);

            if (studentUpdateError) throw studentUpdateError;

            setAlertMessage({ type: 'success', text: `Successfully recorded payment of ₹${amt} for ${selectedStudent.name}.` });
            setShowPaymentModal(false);
            
            // Refresh data
            fetchData();
        } catch (err: any) {
            console.error('Error saving payment:', err);
            setAlertMessage({ type: 'error', text: `Failed to record payment: ${err.message}` });
        } finally {
            setRecordingPayment(false);
        }
    };

    // Fetch Student History (Payments & Notifications)
    const openHistoryModal = async (student: StudentFeesData) => {
        setSelectedStudent(student);
        setHistoryLoading(true);
        setShowHistoryModal(true);
        try {
            // Fetch Payments
            const { data: paymentsData } = await supabaseAuth
                .from('fees_payments')
                .select('*')
                .eq('student_id', student.id)
                .order('payment_date', { ascending: false });
            
            setStudentPayments(paymentsData || []);

            // Fetch Notifications
            const { data: notificationsData } = await supabaseAuth
                .from('fees_notifications')
                .select('*')
                .eq('student_id', student.id)
                .order('sent_at', { ascending: false });

            setStudentNotifications(notificationsData || []);
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Send Reminder Notification (Simulated)
    const handleSendReminder = async (student: StudentFeesData, type: 'due_date' | 'classes_completed') => {
        try {
            // 1. Insert record in fees_notifications
            const { error } = await supabaseAuth
                .from('fees_notifications')
                .insert([{
                    student_id: student.id,
                    notification_type: type,
                    channel: 'email',
                    status: 'sent'
                }]);

            if (error) throw error;

            setAlertMessage({ 
                type: 'success', 
                text: `Reminder notification sent successfully to ${student.name} (${student.email}) via Email!` 
            });

            // If history modal is currently open, refresh notifications list
            if (selectedStudent?.id === student.id) {
                const { data: notificationsData } = await supabaseAuth
                    .from('fees_notifications')
                    .select('*')
                    .eq('student_id', student.id)
                    .order('sent_at', { ascending: false });
                setStudentNotifications(notificationsData || []);
            }
        } catch (err: any) {
            console.error('Error sending reminder:', err);
            setAlertMessage({ type: 'error', text: `Failed to log reminder: ${err.message}` });
        }
    };

    return (
        <div className="bg-[#f8f8f6] dark:bg-[#221d10] text-slate-900 dark:text-slate-100 font-sans min-h-screen">
            <div className="flex h-screen overflow-hidden">
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

                <main className="flex-1 flex flex-col min-w-0">
                    <TeacherHeader 
                        title="Fees Management" 
                        backLink={teacherProfile?.role === 'admin' ? '/admin-dashboard' : '/teacher-dashboard'}
                    />

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-12">
                        <div className="w-full space-y-8">
                            
                            {/* Header Section */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Fees Dashboard</h1>
                                    <p className="text-slate-500 dark:text-slate-400 mt-2.5">Track joining dates, collection cycles, payments history, and prepaid class balances.</p>
                                </div>
                                {alertMessage && (
                                    <div className={`px-4 py-3 rounded-xl border text-sm font-semibold shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${
                                        alertMessage.type === 'success' 
                                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-150 dark:border-emerald-900/30' 
                                            : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-150 dark:border-rose-900/30'
                                    }`}>
                                        {alertMessage.text}
                                    </div>
                                )}
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-5">
                                    <div className="size-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                        <DollarSign className="size-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Collected This Month</p>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">₹{statsSummary.totalCollected.toLocaleString('en-IN')}</p>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-5">
                                    <div className="size-12 rounded-xl bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                                        <AlertTriangle className="size-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Overdue Students</p>
                                        <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{statsSummary.overdueCount}</p>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-5">
                                    <div className="size-12 rounded-xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                        <AlertTriangle className="size-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Classes Expired</p>
                                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{statsSummary.dueClassesCount}</p>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-5">
                                    <div className="size-12 rounded-xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                        <ShieldCheck className="size-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Students in Good Standing</p>
                                        <p className="text-2xl font-black text-green-600 dark:text-green-500 mt-1">{statsSummary.goodCount} / {statsSummary.totalStudents}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Main Filter & Table Board */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                                
                                {/* Filters Panel */}
                                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/40">
                                    <div className="relative flex-1 max-w-md">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                        <input
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] outline-none transition-all"
                                            placeholder="Search students by name..."
                                            type="text"
                                        />
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-3">
                                        {/* Status Filter */}
                                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase pl-1.5">Status:</span>
                                            <select
                                                value={statusFilter}
                                                onChange={e => setStatusFilter(e.target.value as any)}
                                                className="bg-transparent border-none text-xs font-semibold py-1.5 pr-8 focus:ring-0 outline-none cursor-pointer"
                                            >
                                                <option value="all">All statuses</option>
                                                <option value="good">Paid & Active</option>
                                                <option value="due_classes">Classes Completed</option>
                                                <option value="due_date">Due Date Arrived</option>
                                                <option value="overdue">Overdue (Both)</option>
                                            </select>
                                        </div>

                                        {/* Basis Filter */}
                                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase pl-1.5">Basis:</span>
                                            <select
                                                value={basisFilter}
                                                onChange={e => setBasisFilter(e.target.value as any)}
                                                className="bg-transparent border-none text-xs font-semibold py-1.5 pr-8 focus:ring-0 outline-none cursor-pointer"
                                            >
                                                <option value="all">All plans</option>
                                                <option value="monthly">Monthly</option>
                                                <option value="class">Class-basis</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="overflow-x-auto min-h-[350px]">
                                    <table className="w-full border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 bg-slate-50/20">
                                                <th className="px-6 py-4">Student</th>
                                                <th className="px-6 py-4">Joining Date</th>
                                                <th className="px-6 py-4">Billing Plan</th>
                                                <th className="px-6 py-4">Prepaid Classes</th>
                                                <th className="px-6 py-4">Next Collection</th>
                                                <th className="px-6 py-4">Standard Amount</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {paginatedStudents.length > 0 ? (
                                                paginatedStudents.map(student => {
                                                    const status = getStudentStatus(student);
                                                    return (
                                                        <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                                                            
                                                            {/* Student Profile */}
                                                            <td className="px-6 py-4.5">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="size-9 rounded-xl bg-[#ecb613]/10 text-[#ecb613] font-bold flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                                                                        {student.profile_pic_url ? (
                                                                            <img src={student.profile_pic_url} alt="" className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <span>{student.name.charAt(0)}</span>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{student.name}</p>
                                                                        <p className="text-[10px] font-medium text-slate-400 mt-1">{student.batch_name}</p>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Joining Date */}
                                                            <td className="px-6 py-4.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                                {student.join_date ? new Date(student.join_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                                            </td>

                                                            {/* Billing Plan */}
                                                            <td className="px-6 py-4.5">
                                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                                                                    student.fees_basis === 'monthly'
                                                                        ? 'bg-purple-50 dark:bg-purple-950/20 text-purple-750 border border-purple-100 dark:border-purple-900/30'
                                                                        : 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 border border-indigo-100 dark:border-indigo-900/30'
                                                                }`}>
                                                                    {student.fees_basis === 'monthly' ? 'Monthly' : 'Class Basis'}
                                                                </span>
                                                            </td>

                                                            {/* Prepaid Classes Balance */}
                                                            <td className="px-6 py-4.5">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-sm font-black ${
                                                                        student.fees_classes_paid <= 0
                                                                            ? 'text-rose-600 dark:text-rose-400'
                                                                            : student.fees_classes_paid === 1
                                                                                ? 'text-amber-500'
                                                                                : 'text-slate-800 dark:text-slate-200'
                                                                    }`}>
                                                                        {student.fees_classes_paid}
                                                                    </span>
                                                                    <span className="text-[10px] font-semibold text-slate-400">
                                                                        classes left
                                                                    </span>
                                                                </div>
                                                            </td>

                                                            {/* Next Collection Date */}
                                                            <td className="px-6 py-4.5 text-xs font-bold text-slate-700 dark:text-slate-350">
                                                                {student.fees_collection_date 
                                                                    ? new Date(student.fees_collection_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
                                                                    : 'N/A'
                                                                }
                                                            </td>

                                                            {/* Fees Amount */}
                                                            <td className="px-6 py-4.5 text-sm font-bold text-slate-800 dark:text-slate-200">
                                                                ₹{student.fees_amount.toLocaleString('en-IN')}
                                                            </td>

                                                            {/* Status Badge */}
                                                            <td className="px-6 py-4.5">
                                                                {status === 'good' && (
                                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900/30">
                                                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                                                        Active / Paid
                                                                    </span>
                                                                )}
                                                                {status === 'due_classes' && (
                                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
                                                                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                                                                        Classes Expired
                                                                    </span>
                                                                )}
                                                                {status === 'due_date' && (
                                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
                                                                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                                                                        Due Date Arrived
                                                                    </span>
                                                                )}
                                                                {status === 'overdue' && (
                                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-450 border border-rose-100 dark:border-rose-900/30">
                                                                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                                                                        Overdue
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* Actions */}
                                                            <td className="px-6 py-4.5 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {status !== 'good' && (
                                                                        <button
                                                                            onClick={() => handleSendReminder(student, status === 'due_classes' ? 'classes_completed' : 'due_date')}
                                                                            title="Send Reminder Notification"
                                                                            className="p-2 rounded-lg border border-slate-200 hover:border-[#ecb613] dark:border-slate-800 hover:bg-[#ecb613]/5 text-slate-500 hover:text-[#ecb613] transition-colors"
                                                                        >
                                                                            <Mail className="size-4" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => openHistoryModal(student)}
                                                                        title="View Payment History"
                                                                        className="p-2 rounded-lg border border-slate-200 hover:border-[#ecb613] dark:border-slate-800 hover:bg-[#ecb613]/5 text-slate-500 hover:text-[#ecb613] transition-colors"
                                                                    >
                                                                        <History className="size-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => openPaymentModal(student)}
                                                                        className="px-3 py-1.5 text-xs font-black bg-[#ecb613] hover:bg-[#ecb613]/90 text-white rounded-lg shadow-sm shadow-[#ecb613]/10 hover:shadow transition-all active:scale-[0.97]"
                                                                    >
                                                                        Collect ₹
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                                                        <span className="material-symbols-outlined text-4xl block mb-2">payments</span>
                                                        <p className="text-sm font-semibold">No students found matching filters.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Footer */}
                                {totalPages > 1 && (
                                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-500">
                                        <span>Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length)} of {filteredStudents.length} Students</span>
                                        <div className="flex gap-2">
                                            <button
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(p => p - 1)}
                                                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                                            >
                                                Previous
                                            </button>
                                            <button
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(p => p + 1)}
                                                className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </main>
            </div>

            {/* ─── Record Payment Modal ───────────────────────────────────────────── */}
            {showPaymentModal && selectedStudent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Record Fee Payment</h3>
                                <p className="text-xs text-slate-400 mt-1">Collecting fees in advance for {selectedStudent.name}</p>
                            </div>
                            <button onClick={() => setShowPaymentModal(false)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Amount Paid (₹)</label>
                                    <input
                                        required
                                        type="number"
                                        value={paymentAmount}
                                        onChange={e => setPaymentAmount(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#ecb613]/25 outline-none font-bold"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Classes Added</label>
                                    <input
                                        required
                                        type="number"
                                        value={classesAdded}
                                        onChange={e => setClassesAdded(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#ecb613]/25 outline-none font-bold"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Payment Method</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={e => setPaymentMethod(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#ecb613]/25 outline-none font-bold"
                                    >
                                        <option value="UPI">UPI / GPay / PhonePe</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Card">Credit/Debit Card</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Payment Date</label>
                                    <input
                                        required
                                        type="date"
                                        value={paymentDate}
                                        onChange={e => handlePaymentDateChange(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#ecb613]/25 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Next Due Date (Collection Date)</label>
                                <input
                                    required={selectedStudent.fees_basis === 'monthly'}
                                    type="date"
                                    value={nextDueDate}
                                    onChange={e => setNextDueDate(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#ecb613]/25 outline-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Notes / Memo</label>
                                <textarea
                                    value={paymentNotes}
                                    onChange={e => setPaymentNotes(e.target.value)}
                                    placeholder="Enter receipt number, months covered, or extra context..."
                                    rows={2}
                                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#ecb613]/25 outline-none resize-none"
                                />
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(false)}
                                    className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={recordingPayment}
                                    className="px-6 py-2.5 text-sm font-black bg-[#ecb613] text-white hover:bg-[#ecb613]/90 rounded-xl shadow-md shadow-[#ecb613]/20 flex items-center gap-2"
                                >
                                    {recordingPayment ? (
                                        <><Loader2 className="size-4 animate-spin" /> Recording...</>
                                    ) : (
                                        <><Check size={16} /> Record Payment</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Payment History & Logs Modal ─────────────────────────────────────── */}
            {showHistoryModal && selectedStudent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Fees History: {selectedStudent.name}</h3>
                                <p className="text-xs text-slate-400 mt-1">Payment logs, billing plan updates, and alert logs</p>
                            </div>
                            <button onClick={() => setShowHistoryModal(false)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            
                            {/* Summary widget */}
                            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-150 dark:border-slate-800">
                                <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400">Joining Date</p>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-350 mt-1">
                                        {new Date(selectedStudent.join_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400">Standard Amount</p>
                                    <p className="text-xs font-bold text-slate-850 dark:text-slate-200 mt-1">₹{selectedStudent.fees_amount.toLocaleString('en-IN')}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400">Prepaid Classes Left</p>
                                    <p className="text-xs font-black text-[#ecb613] mt-1">{selectedStudent.fees_classes_paid} classes</p>
                                </div>
                            </div>

                            {historyLoading ? (
                                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                    <Loader2 className="w-8 h-8 animate-spin text-[#ecb613] mb-2" />
                                    <p className="text-xs font-semibold uppercase tracking-wider">Syncing Ledger...</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Payments Section */}
                                    <div>
                                        <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                            <DollarSign className="size-4 text-emerald-600" />
                                            Recorded Payments ({studentPayments.length})
                                        </h4>
                                        
                                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                            {studentPayments.length > 0 ? (
                                                studentPayments.map(pay => (
                                                    <div key={pay.id} className="p-3 bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800/80 rounded-xl flex items-center justify-between text-xs hover:border-[#ecb613]/30 transition-all">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-slate-900 dark:text-white">₹{pay.amount}</span>
                                                                <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">{pay.payment_method}</span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-450 mt-1">
                                                                {pay.notes ? `"${pay.notes}"` : 'No notes added'}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-bold text-slate-700 dark:text-slate-300">+{pay.classes_added} classes</p>
                                                            <p className="text-[9px] text-slate-400 mt-1">
                                                                Paid on {new Date(pay.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-center py-6 text-xs text-slate-400 italic">No payments recorded for this student.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Notifications Section */}
                                    <div>
                                        <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                            <Mail className="size-4 text-[#ecb613]" />
                                            Alert & Reminder Logs ({studentNotifications.length})
                                        </h4>

                                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                            {studentNotifications.length > 0 ? (
                                                studentNotifications.map(notif => (
                                                    <div key={notif.id} className="p-2.5 bg-slate-50/50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800/50 rounded-xl flex items-center justify-between text-xs">
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="material-symbols-outlined text-slate-400 text-lg">
                                                                {notif.notification_type === 'classes_completed' ? 'warning' : 'event_note'}
                                                            </span>
                                                            <div>
                                                                <p className="font-bold text-slate-800 dark:text-slate-205">
                                                                    {notif.notification_type === 'classes_completed' 
                                                                        ? 'Class Limit Reached Alert' 
                                                                        : 'Due Date Billing Reminder'
                                                                    }
                                                                </p>
                                                                <p className="text-[9px] text-slate-450 mt-0.5">Sent via {notif.channel}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30 uppercase">Sent</span>
                                                            <p className="text-[9px] text-slate-400 mt-1">
                                                                {new Date(notif.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-center py-6 text-xs text-slate-400 italic">No reminder alerts logged yet.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/10 flex items-center justify-end border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowHistoryModal(false)}
                                className="px-5 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                            >
                                Close Ledger
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
