'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, Plus, Calendar, DollarSign, Users, AlertTriangle, ShieldCheck, Mail, History, Send, Check } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import { getStudentFeeStatus, calculateClassesAdded } from '../../../src/lib/fee-utils';

interface StudentFeesData {
    id: string;
    name: string;
    email: string;
    phone: string;
    profile_pic_url?: string;
    join_date: string;
    fees_basis: 'monthly' | 'class';
    fees_amount: number;
    fees_collection_date: number | null;
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
    status?: string;
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
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; role?: string; profile_pic_url?: string } | null>(null);
    const [students, setStudents] = useState<StudentFeesData[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    
    // UI Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
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

            // Clear unread fees notifications for the admin
            await supabaseAuth
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', userId)
                .eq('type', 'fees')
                .eq('is_read', false);

            // 2. Fetch Teacher Profile
            const { data: profile, error: profileError } = await supabaseAuth
                .from('users')
                .select('name, email, role, profile_pic_url')
                .eq('id', userId)
                .single();

            if (profileError || profile?.role !== 'admin') {
                router.push('/teacher-dashboard');
                return;
            }

            setTeacherProfile({ id: userId, name: profile.name, email: profile.email, role: profile.role, profile_pic_url: profile.profile_pic_url });

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
                .eq('role', 'student');

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

            // 4. Fetch Payments from last 60 days
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            const startSearchDate = sixtyDaysAgo.toISOString().split('T')[0];
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
                    status,
                    created_at
                `)
                .gte('payment_date', startSearchDate);

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

        // Subscribe to realtime updates on fees_payments table
        const feesChannel = supabaseAuth
            .channel('admin-fees-payments-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'fees_payments' },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabaseAuth.removeChannel(feesChannel);
        };
    }, [router]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    // Calculate student payment status
    const getStudentStatus = (student: StudentFeesData) => {
        if (student.fees_amount <= 0) return 'setup_required';
        const classesCompleted = student.fees_classes_paid <= 0;
        
        const studentPayments = payments.filter(p => p.student_id === student.id);
        const hasPending = studentPayments.some(p => p.status === 'pending_approval');
        if (hasPending) return 'pending_verification';

        if (student.fees_basis === 'monthly' && student.fees_collection_date) {
            const feeStatus = getStudentFeeStatus(
                student.fees_basis,
                Number(student.fees_collection_date),
                studentPayments
            );

            if (feeStatus) {
                const dateIsDue = feeStatus.status === 'overdue' || feeStatus.status === 'due';
                if (dateIsDue && classesCompleted) {
                    return 'overdue';
                } else if (classesCompleted) {
                    return 'due_classes';
                } else if (feeStatus.status === 'overdue') {
                    return 'overdue';
                } else if (feeStatus.status === 'due') {
                    return 'due_date';
                } else {
                    return 'good';
                }
            }
        }

        // Fallback or class-basis
        return classesCompleted ? 'due_classes' : 'good';
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
            if (statusFilter === 'overdue_due') {
                result = result.filter(s => {
                    const status = getStudentStatus(s);
                    return status === 'overdue' || status === 'due_classes' || status === 'due_date';
                });
            } else {
                result = result.filter(s => getStudentStatus(s) === statusFilter);
            }
        }

        // Sort by status severity, then name
        const statusPriority: Record<string, number> = { overdue: 0, setup_required: 1, due_classes: 2, due_date: 3, good: 4 };
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
        let setupCount = 0;
        let pendingCount = 0;

        students.forEach(s => {
            const status = getStudentStatus(s);
            if (status === 'overdue') overdueCount++;
            else if (status === 'due_classes') dueClassesCount++;
            else if (status === 'due_date') dueDateCount++;
            else if (status === 'setup_required') setupCount++;
            else if (status === 'pending_verification') pendingCount++;
            else goodCount++;
        });

        return {
            totalCollected,
            overdueCount,
            dueClassesCount,
            dueDateCount,
            goodCount,
            setupCount,
            pendingCount,
            totalStudents: students.length
        };
    }, [students, payments]);

    const tabs = useMemo(() => [
        { id: 'all', label: 'All Students', count: statsSummary.totalStudents },
        { id: 'pending_verification', label: 'Pending Review', count: statsSummary.pendingCount },
        { id: 'overdue_due', label: 'Overdue / Due', count: statsSummary.overdueCount + statsSummary.dueClassesCount + statsSummary.dueDateCount },
        { id: 'good', label: 'Good Standing', count: statsSummary.goodCount },
        { id: 'setup_required', label: 'Setup Required', count: statsSummary.setupCount }
    ], [statsSummary]);

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

            // Also insert notification in public.notifications for the student
            await supabaseAuth.from('notifications').insert({
                user_id: student.id,
                title: type === 'classes_completed' ? 'Fees Due: Classes Completed' : 'Fees Due: Payment Reminder',
                message: type === 'classes_completed' 
                    ? 'Your prepaid classes are completed. Please submit your fee payment.' 
                    : `Your monthly fee payment is due. Please submit your fee payment.`,
                is_read: false
            });

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

    const handleApprovePayment = async (paymentId: string, studentId: string, amount: number, basis: string) => {
        try {
            const student = students.find(s => s.id === studentId);
            const studentFeesAmount = student ? student.fees_amount : (selectedStudent?.fees_amount || 0);
            const classesToAdd = calculateClassesAdded(amount, studentFeesAmount);

            // Update payment status
            const { error: paymentError } = await supabaseAuth
                .from('fees_payments')
                .update({ status: 'approved', classes_added: classesToAdd })
                .eq('id', paymentId);
            
            if (paymentError) throw paymentError;

            // Update student balance
            const currentClasses = student ? student.fees_classes_paid : (selectedStudent?.fees_classes_paid || 0);
            const newClassesPaid = currentClasses + classesToAdd;
            
            const { error: studentUpdateError } = await supabaseAuth
                .from('users')
                .update({ fees_classes_paid: newClassesPaid })
                .eq('id', studentId);
            
            if (studentUpdateError) throw studentUpdateError;
            
            if (selectedStudent && selectedStudent.id === studentId) {
                setSelectedStudent({ ...selectedStudent, fees_classes_paid: newClassesPaid });
            }

            // Also insert notification for the student to confirm approval and classes credited
            await supabaseAuth.from('notifications').insert({
                user_id: studentId,
                title: 'Fee Payment Approved',
                message: `Your reported payment of ₹${amount.toLocaleString('en-IN')} has been approved. ${classesToAdd} classes have been credited to your balance.`,
                is_read: false
            });

            setAlertMessage({ type: 'success', text: `Payment approved and balance updated.` });
            
            // Refresh local modal state
            setStudentPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'approved', classes_added: classesToAdd } : p));
            fetchData();
        } catch (err: any) {
            console.error('Error approving payment:', err);
            setAlertMessage({ type: 'error', text: `Failed to approve payment: ${err.message}` });
        }
    };

    const handleRejectPayment = async (paymentId: string) => {
        try {
            // Find the payment to get the student_id and amount
            const { data: paymentData } = await supabaseAuth
                .from('fees_payments')
                .select('student_id, amount')
                .eq('id', paymentId)
                .single();

            const { error } = await supabaseAuth
                .from('fees_payments')
                .update({ status: 'rejected' })
                .eq('id', paymentId);
            
            if (error) throw error;

            if (paymentData) {
                // Add a notification for the student
                await supabaseAuth.from('notifications').insert({
                    user_id: paymentData.student_id,
                    title: 'Fee Payment Marked Not Received',
                    message: `Your reported payment of ₹${paymentData.amount.toLocaleString('en-IN')} was marked as not received by the admin. Please verify and try again.`,
                    is_read: false
                });
            }

            setAlertMessage({ type: 'success', text: `Payment rejected.` });
            setStudentPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: 'rejected' } : p));
            fetchData();
        } catch (err: any) {
            console.error('Error rejecting payment:', err);
            setAlertMessage({ type: 'error', text: `Failed to reject payment: ${err.message}` });
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
                                    <h1 className="text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-none">Fees Dashboard</h1>
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
                                    <div className="size-12 rounded-xl bg-kfa-gold-100 dark:bg-kfa-gold-800/30 flex items-center justify-center text-kfa-gold dark:text-kfa-gold-dark">
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
                                        <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 leading-none">{statsSummary.overdueCount}</p>
                                        <p className="text-[10px] font-semibold text-slate-400 mt-1">Payment past due date</p>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-5">
                                    <div className="size-12 rounded-xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                        <AlertTriangle className="size-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Classes Expired</p>
                                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 leading-none">{statsSummary.dueClassesCount}</p>
                                        <p className="text-[10px] font-semibold text-slate-400 mt-1">Prepaid classes used up</p>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-5">
                                    <div className="size-12 rounded-xl bg-kfa-teal-100 dark:bg-kfa-teal-800/30 flex items-center justify-center text-kfa-teal dark:text-kfa-teal-dark">
                                        <ShieldCheck className="size-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Good Standing</p>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 leading-none">{statsSummary.goodCount} / {statsSummary.totalStudents}</p>
                                        <p className="text-[10px] font-semibold text-slate-400 mt-1">Active & Paid</p>
                                    </div>
                                </div>
                            </div>

                            {/* Main Filter & Table Board */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                                
                                {/* Tabs Panel */}
                                <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 px-6 flex flex-wrap gap-1">
                                    {tabs.map(tab => {
                                        const isActive = statusFilter === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setStatusFilter(tab.id)}
                                                className={`px-4 py-4 text-xs font-bold transition-all relative border-b-2 -mb-px flex items-center gap-2 ${
                                                    isActive
                                                        ? 'border-[#ecb613] text-[#b45309] dark:text-[#ecb613]'
                                                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                }`}
                                            >
                                                <span>{tab.label}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                    isActive
                                                        ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                                }`}>
                                                    {tab.count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

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

                                {/* Mobile Cards View */}
                                <div className="block lg:hidden divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
                                    {paginatedStudents.length > 0 ? (
                                        paginatedStudents.map(student => {
                                            const status = getStudentStatus(student);
                                            const rowUrgencyClass = status === 'overdue' 
                                                ? 'border-l-4 border-l-rose-500 bg-rose-50/10 dark:bg-rose-950/10'
                                                : status === 'due_classes'
                                                ? 'border-l-4 border-l-amber-500 bg-amber-50/10 dark:bg-amber-950/10'
                                                : status === 'pending_verification'
                                                ? 'border-l-4 border-l-blue-500 bg-blue-50/10 dark:bg-blue-950/10'
                                                : status === 'setup_required'
                                                ? 'border-l-4 border-l-slate-300 dark:border-l-slate-600 bg-slate-50 dark:bg-slate-800/30'
                                                : 'border-l-4 border-l-transparent hover:bg-slate-50/50 dark:hover:bg-slate-800/10';
                                            return (
                                                <div key={student.id} className={`p-4 space-y-3 ${rowUrgencyClass}`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="size-10 rounded-full bg-[#ecb613]/10 text-[#ecb613] font-bold flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm">
                                                                {student.profile_pic_url ? (
                                                                    <img src={student.profile_pic_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span>{student.name.charAt(0)}</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{student.name}</p>
                                                                <p className="text-[10px] font-medium text-slate-400 mt-1">{student.batch_name === 'Unassigned' ? 'No Batch' : student.batch_name}</p>
                                                            </div>
                                                        </div>
                                                        <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                                                            ₹{student.fees_amount.toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Plan</span>
                                                            <span className="font-semibold text-slate-700 dark:text-slate-300">{student.fees_basis === 'monthly' ? 'Monthly' : 'Class Basis'}</span>
                                                        </div>
                                                        <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Classes Left</span>
                                                            <span className={`font-black ${
                                                                student.fees_classes_paid <= 0
                                                                    ? 'text-rose-600 dark:text-rose-400'
                                                                    : student.fees_classes_paid === 1
                                                                        ? 'text-amber-500'
                                                                        : 'text-slate-700 dark:text-slate-300'
                                                            }`}>{student.fees_classes_paid}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                                                        <div className="flex items-center gap-2">
                                                            {status === 'good' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Active</span>
                                                            )}
                                                            {status === 'overdue' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">Overdue</span>
                                                            )}
                                                            {status === 'due_classes' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">Classes Expired</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => openHistoryModal(student)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500">
                                                                <History className="size-4" />
                                                            </button>
                                                            {status !== 'setup_required' && (
                                                                <button onClick={() => openPaymentModal(student)} className="px-3 py-1.5 text-xs font-black bg-[#ecb613] text-white rounded-lg shadow-sm">
                                                                    Collect ₹
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="p-8 text-center text-slate-400">
                                            <DollarSign className="size-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-sm font-bold">No students found</p>
                                        </div>
                                    )}
                                </div>

                                {/* Table */}
                                <div className="hidden lg:block overflow-x-auto min-h-[350px]">
<<<<<<< Updated upstream
                                    <table className="w-full min-w-[1100px] border-collapse text-left">
=======
                                    <table className="w-full border-collapse text-left">
>>>>>>> Stashed changes
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 bg-slate-50/20">
                                                <th className="px-6 py-4 whitespace-nowrap">Student</th>
                                                <th className="px-6 py-4 whitespace-nowrap">Joining Date</th>
                                                <th className="px-6 py-4 whitespace-nowrap">Billing Plan</th>
                                                <th className="px-6 py-4 whitespace-nowrap">Prepaid Classes</th>
                                                <th className="px-6 py-4 whitespace-nowrap">Next Collection</th>
                                                <th className="px-6 py-4 whitespace-nowrap">Standard Amount</th>
                                                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                                                <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {paginatedStudents.length > 0 ? (
                                                paginatedStudents.map(student => {
                                                    const status = getStudentStatus(student);
                                                    const rowUrgencyClass = status === 'overdue' 
                                                        ? 'border-l-4 border-l-rose-500 bg-rose-50/10 hover:bg-rose-50/40 dark:bg-rose-950/10'
                                                        : status === 'due_classes'
                                                        ? 'border-l-4 border-l-amber-500 bg-amber-50/10 hover:bg-amber-50/40 dark:bg-amber-950/10'
                                                        : status === 'pending_verification'
                                                        ? 'border-l-4 border-l-blue-500 bg-blue-50/10 hover:bg-blue-50/40 dark:bg-blue-950/10'
                                                        : status === 'setup_required'
                                                        ? 'border-l-4 border-l-slate-300 dark:border-l-slate-600 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/30'
                                                        : 'border-l-4 border-l-transparent hover:bg-slate-50/50 dark:hover:bg-slate-800/10';

                                                    return (
                                                        <tr key={student.id} className={`transition-colors border-b border-b-slate-100 dark:border-b-slate-800 ${rowUrgencyClass}`}>
                                                            
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
                                                                        <p className="text-[10px] font-medium text-slate-400 mt-1">{student.batch_name === 'Unassigned' ? 'No Batch' : student.batch_name}</p>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Joining Date */}
                                                            <td className="px-6 py-4.5 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
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
                                                            <td className="px-6 py-4.5 whitespace-nowrap">
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
                                                            <td className="px-6 py-4.5 text-xs font-bold text-slate-700 dark:text-slate-350 whitespace-nowrap">
                                                                {(() => {
                                                                    if (student.fees_amount <= 0) return <span className="text-slate-400 italic font-medium text-[10px]">Setup Required</span>;
                                                                    
                                                                    if (student.fees_basis === 'monthly') {
                                                                        if (student.fees_collection_date) {
                                                                            const studentPayments = payments.filter(p => p.student_id === student.id);
                                                                            const feeStatus = getStudentFeeStatus(
                                                                                student.fees_basis,
                                                                                Number(student.fees_collection_date),
                                                                                studentPayments
                                                                            );
                                                                            return feeStatus ? feeStatus.formattedDueDate : 'N/A';
                                                                        } else if (student.join_date) {
                                                                            // Calculate 30 days from join date as estimated next collection
                                                                            const joinD = new Date(student.join_date);
                                                                            joinD.setDate(joinD.getDate() + 30);
                                                                            return <span className="text-slate-400 italic">Est: {joinD.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>;
                                                                        }
                                                                    }
                                                                    return <span className="text-slate-400 text-[10px]">Based on usage</span>;
                                                                })()}
                                                            </td>

                                                            {/* Fees Amount */}
                                                            <td className="px-6 py-4.5 text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                                                ₹{student.fees_amount.toLocaleString('en-IN')}
                                                            </td>

                                                            {/* Status Badge */}
                                                            <td className="px-6 py-4.5 whitespace-nowrap">
                                                                {status === 'setup_required' && (
                                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                        Setup Required
                                                                    </span>
                                                                )}
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
                                                                {status === 'pending_verification' && (() => {
                                                                    const pendingPayment = payments.find(p => p.student_id === student.id && p.status === 'pending_approval');
                                                                    const amountStr = pendingPayment ? ` (₹${pendingPayment.amount.toLocaleString('en-IN')})` : '';
                                                                    return (
                                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-450 border border-blue-100 dark:border-blue-900/30 animate-pulse">
                                                                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                                                            Pending Review{amountStr}
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </td>

                                                            {/* Actions */}
                                                            <td className="px-6 py-4.5 text-right whitespace-nowrap">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {status !== 'good' && status !== 'setup_required' && (
                                                                        <button
                                                                            onClick={() => handleSendReminder(student, status === 'due_classes' ? 'classes_completed' : 'due_date')}
                                                                            title="Send Reminder Email"
                                                                            aria-label={`Send Reminder Email to ${student.name}`}
                                                                            className="p-2 rounded-lg border border-slate-200 hover:border-[#ecb613] dark:border-slate-800 hover:bg-[#ecb613]/5 text-slate-500 hover:text-[#ecb613] transition-colors"
                                                                        >
                                                                            <Mail className="size-4" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => openHistoryModal(student)}
                                                                        title="View Payment History"
                                                                        aria-label={`View Payment History for ${student.name}`}
                                                                        className="p-2 rounded-lg border border-slate-200 hover:border-[#ecb613] dark:border-slate-800 hover:bg-[#ecb613]/5 text-slate-500 hover:text-[#ecb613] transition-colors"
                                                                    >
                                                                        <History className="size-4" />
                                                                    </button>
                                                                    {status === 'setup_required' ? (
                                                                        <div className="group relative">
                                                                            <button disabled className="px-3 py-1.5 text-xs font-black bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 rounded-lg shadow-sm cursor-not-allowed">
                                                                                Collect ₹
                                                                            </button>
                                                                            <div className="absolute bottom-full mb-2 right-0 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl text-center z-10 pointer-events-none">
                                                                                No standard fee amount is configured for this student. Update their profile first.
                                                                            </div>
                                                                        </div>
                                                                    ) : status === 'pending_verification' ? (
                                                                        <div className="flex items-center gap-1.5 animate-in fade-in duration-300">
                                                                            <button
                                                                                onClick={() => {
                                                                                    const pendingPayment = payments.find(p => p.student_id === student.id && p.status === 'pending_approval');
                                                                                    if (pendingPayment) {
                                                                                        handleRejectPayment(pendingPayment.id);
                                                                                    }
                                                                                }}
                                                                                className="px-2.5 py-1.5 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition-all active:scale-[0.97]"
                                                                            >
                                                                                Not Received
                                                                            </button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const pendingPayment = payments.find(p => p.student_id === student.id && p.status === 'pending_approval');
                                                                                    if (pendingPayment) {
                                                                                        handleApprovePayment(pendingPayment.id, student.id, pendingPayment.amount, student.fees_basis);
                                                                                    }
                                                                                }}
                                                                                className="px-2.5 py-1.5 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all active:scale-[0.97]"
                                                                            >
                                                                                Collect
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => openPaymentModal(student)}
                                                                            className="px-3 py-1.5 text-xs font-black bg-[#ecb613] hover:bg-[#ecb613]/90 text-white rounded-lg shadow-sm shadow-[#ecb613]/10 hover:shadow transition-all active:scale-[0.97]"
                                                                        >
                                                                            Collect ₹
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={8} className="px-6 py-16 text-center text-slate-400 bg-slate-50/50 dark:bg-slate-900/20">
                                                        <div className="size-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm mb-4">
                                                            <DollarSign className="size-8 text-kfa-gold/50" />
                                                        </div>
                                                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No matching students found</h3>
                                                        <p className="text-xs text-slate-500 mt-1">Try adjusting your search filters or status selection.</p>
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
                                                    <div key={pay.id} className={`p-3 border rounded-xl flex items-center justify-between text-xs transition-all ${
                                                        pay.status === 'pending_approval' ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 
                                                        pay.status === 'rejected' ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800' :
                                                        'bg-white dark:bg-slate-850 border-slate-100 dark:border-slate-800/80 hover:border-[#ecb613]/30'
                                                    }`}>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-slate-900 dark:text-white">₹{pay.amount}</span>
                                                                <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">{pay.payment_method}</span>
                                                                {pay.status === 'pending_approval' && (
                                                                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase animate-pulse">Needs Review</span>
                                                                )}
                                                                {pay.status === 'rejected' && (
                                                                    <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">Rejected</span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-slate-450 mt-1">
                                                                {pay.notes ? `"${pay.notes}"` : 'No notes added'}
                                                            </p>
                                                        </div>
                                                        <div className="text-right flex flex-col items-end justify-center">
                                                            {pay.status === 'pending_approval' ? (
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <button 
                                                                        onClick={() => handleRejectPayment(pay.id)}
                                                                        className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-bold hover:bg-slate-50 transition-colors"
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleApprovePayment(pay.id, selectedStudent.id, pay.amount, selectedStudent.fees_basis)}
                                                                        className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700 transition-colors"
                                                                    >
                                                                        Approve
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {pay.status !== 'rejected' && (
                                                                        <p className="font-bold text-slate-700 dark:text-slate-300">+{pay.classes_added} classes</p>
                                                                    )}
                                                                    <p className="text-[9px] text-slate-400 mt-1">
                                                                        Paid on {new Date(pay.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                    </p>
                                                                </>
                                                            )}
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
