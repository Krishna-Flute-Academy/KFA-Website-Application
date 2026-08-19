'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2, Plus, Calendar, DollarSign, Users, AlertTriangle, ShieldCheck, Mail, History, Send, Check, Trash2, Download, FileSpreadsheet } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import { getStudentFeeStatus, calculateClassesAdded } from '../../../src/lib/fee-utils';
import { exportFeesCSV } from '../../../src/lib/csv-export';

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
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; phone?: string | null; role?: string; profile_pic_url?: string | null } | null>(null);
    const [students, setStudents] = useState<StudentFeesData[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    
    const [totalCount, setTotalCount] = useState<number>(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // UI Filters & Sorting
    type SortField = 'name' | 'join_date' | 'fees_basis' | 'fees_classes_paid' | 'next_collection' | 'fees_amount' | 'status' | 'latest_payment';
    type SortOrder = 'asc' | 'desc';

    const [sortField, setSortField] = useState<SortField>('status');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [basisFilter, setBasisFilter] = useState<'all' | 'monthly' | 'class'>('all');
    const [dateFilter, setDateFilter] = useState<string>('all');
    const [classesLeftFilter, setClassesLeftFilter] = useState<string>('all');
    const [amountFilter, setAmountFilter] = useState<string>('all');
    const [collectionFilter, setCollectionFilter] = useState<string>('all');
    const [periodPaymentFilter, setPeriodPaymentFilter] = useState<'received_only' | 'all'>('received_only');
    
    // Month & Date Range Filter State
    const [selectedMonthValue, setSelectedMonthValue] = useState<string>('current_month');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 8;

    // Generate list of months that actually contain payment or student join data
    const monthOptions = useMemo(() => {
        const monthSet = new Set<string>();

        // 1. Scan payments for months with actual data
        payments.forEach(p => {
            if (p.payment_date) {
                const ym = p.payment_date.slice(0, 7);
                if (ym && ym.length === 7 && ym.includes('-')) {
                    monthSet.add(ym);
                }
            }
        });

        // 2. Scan student join dates for months with actual data
        students.forEach(s => {
            if (s.join_date) {
                const ym = s.join_date.slice(0, 7);
                if (ym && ym.length === 7 && ym.includes('-')) {
                    monthSet.add(ym);
                }
            }
        });

        // Always include current month
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        monthSet.add(currentMonthKey);

        // Sort descending (most recent first)
        const sortedMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));

        return sortedMonths.map(ym => {
            const [yyyy, mm] = ym.split('-').map(Number);
            const d = new Date(yyyy, mm - 1, 1);
            const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            return { value: ym, label };
        });
    }, [payments, students]);

    // Formatted label for selected fee period
    const periodDisplayTitle = useMemo(() => {
        if (selectedMonthValue === 'current_month') {
            return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
        if (selectedMonthValue === 'all_time') {
            return 'All Time';
        }
        if (selectedMonthValue === 'custom_range') {
            if (customStartDate && customEndDate) {
                return `${new Date(customStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(customEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            }
            return 'Custom Date Range';
        }
        const [yyyy, mm] = selectedMonthValue.split('-').map(Number);
        const d = new Date(yyyy, mm - 1, 1);
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }, [selectedMonthValue, customStartDate, customEndDate]);

    // Debounce search query by 350ms to eliminate excessive network requests while typing
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Modals
    const [selectedStudent, setSelectedStudent] = useState<StudentFeesData | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [studentPayments, setStudentPayments] = useState<PaymentRecord[]>([]);
    const [studentNotifications, setStudentNotifications] = useState<NotificationRecord[]>([]);
    const [isDeletingPayment, setIsDeletingPayment] = useState<string | null>(null);

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

    // 1. Initial Mount: Check Session, Fetch Profile, Mark Notifications Read (ONCE)
    useEffect(() => {
        let isMounted = true;
        const initDashboard = async () => {
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                const userId = session.user.id;
                const { data: profile, error: profileError } = await supabaseAuth
                    .from('users')
                    .select('name, email, phone, role, profile_pic_url')
                    .eq('id', userId)
                    .single();

                if (profileError || profile?.role !== 'admin') {
                    router.push('/teacher-dashboard');
                    return;
                }

                if (isMounted) {
                    setTeacherProfile({ id: userId, name: profile.name, email: profile.email, phone: profile.phone, role: profile.role, profile_pic_url: profile.profile_pic_url });
                }

                // Clear unread fees notifications once in background
                supabaseAuth
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('user_id', userId)
                    .eq('type', 'fees')
                    .eq('is_read', false)
                    .then(() => {});

            } catch (err) {
                console.error('Error initializing fees dashboard:', err);
            }
        };

        initDashboard();

        // 2. Persistent Single Realtime Subscription Channel
        const feesChannel = supabaseAuth
            .channel('admin-fees-payments-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'fees_payments' },
                () => {
                    fetchDataRef.current?.();
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabaseAuth.removeChannel(feesChannel);
        };
    }, [router]);

    // 3. Fast Data Fetching (Server-Side Range Pagination + Non-blocking UI Refresh)
    const fetchData = useCallback(async () => {
        if (!teacherProfile) return;
        setIsRefreshing(true);
        try {
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            const startSearchDate = sixtyDaysAgo.toISOString().split('T')[0];

            let studentsQuery = supabaseAuth
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
                    status,
                    classroom_students(
                        classrooms(name)
                    )
                `, { count: 'exact' })
                .or('role.eq.student,role.eq.pending,role.eq.mentor')
                .eq('status', 'active');

            if (debouncedSearch.trim() !== '') {
                studentsQuery = studentsQuery.ilike('name', `%${debouncedSearch.trim()}%`);
            }

            if (basisFilter !== 'all') {
                studentsQuery = studentsQuery.eq('fees_basis', basisFilter);
            }

            studentsQuery = studentsQuery
                .order('name', { ascending: true });

            const [studentsRes, paymentsRes] = await Promise.all([
                studentsQuery,
                supabaseAuth
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
                    .order('payment_date', { ascending: false })
            ]);

            if (studentsRes.data) {
                const formatted: StudentFeesData[] = studentsRes.data
                    .filter((s: any) => {
                        const stLower = (s.status || '').toLowerCase();
                        if (stLower === 'archived' || stLower === 'inactive') return false;

                        const studentClassroomRef = s.classroom_students?.[0] as any;
                        const studentClassroom = studentClassroomRef?.classrooms;
                        const batch_name = Array.isArray(studentClassroom) 
                            ? studentClassroom[0]?.name 
                            : studentClassroom?.name;

                        if (batch_name && String(batch_name).toLowerCase().includes('learning circle')) {
                            return false;
                        }
                        return true;
                    })
                    .map((s: any) => {
                        const studentClassroomRef = s.classroom_students?.[0] as any;
                        const studentClassroom = studentClassroomRef?.classrooms;
                        const batch_name = Array.isArray(studentClassroom) 
                            ? studentClassroom[0]?.name 
                            : studentClassroom?.name;

                        const joinDateVal = s.join_date || s.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];
                        const derivedCollectionDate = s.fees_collection_date 
                            ? Number(s.fees_collection_date) 
                            : (joinDateVal ? new Date(joinDateVal).getDate() : 1);

                        return {
                            id: s.id,
                            name: s.name,
                            email: s.email || '',
                            phone: s.phone || '',
                            profile_pic_url: s.profile_pic_url,
                            join_date: joinDateVal,
                            fees_basis: s.fees_basis || 'monthly',
                            fees_amount: Number(s.fees_amount) || 0,
                            fees_collection_date: derivedCollectionDate,
                            fees_classes_paid: Number(s.fees_classes_paid) || 0,
                            batch_name: batch_name || 'Unassigned'
                        };
                    });
                setStudents(formatted);
                setTotalCount(studentsRes.count ?? formatted.length);
            }

            if (paymentsRes.data) {
                setPayments(paymentsRes.data as any);
            }

        } catch (err) {
            console.error('Error fetching fees dashboard data:', err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [teacherProfile, debouncedSearch, basisFilter]);

    const fetchDataRef = useRef(fetchData);
    useEffect(() => {
        fetchDataRef.current = fetchData;
    }, [fetchData]);

    useEffect(() => {
        if (teacherProfile) {
            fetchData();
        }
    }, [teacherProfile, debouncedSearch, basisFilter, fetchData]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    // Pre-index payments by student_id for O(1) instant lookup
    const paymentsMap = useMemo(() => {
        const map: Record<string, PaymentRecord[]> = {};
        payments.forEach(p => {
            if (!map[p.student_id]) map[p.student_id] = [];
            map[p.student_id].push(p);
        });
        return map;
    }, [payments]);

    // Active fee period target date evaluation
    const activePeriodDate = useMemo(() => {
        if (selectedMonthValue === 'current_month' || selectedMonthValue === 'all_time') {
            return new Date();
        }
        if (selectedMonthValue === 'custom_range') {
            return customEndDate ? new Date(customEndDate) : new Date();
        }
        if (selectedMonthValue.includes('-')) {
            const [yyyy, mm] = selectedMonthValue.split('-').map(Number);
            return new Date(yyyy, mm - 1, 15);
        }
        return new Date();
    }, [selectedMonthValue, customEndDate]);

    // Period date bounds (start and end date string YYYY-MM-DD)
    const periodDateRange = useMemo(() => {
        let startDateStr = '1970-01-01';
        let endDateStr = '2099-12-31';

        if (selectedMonthValue === 'current_month') {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate();
            startDateStr = `${yyyy}-${mm}-01`;
            endDateStr = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
        } else if (selectedMonthValue === 'custom_range') {
            startDateStr = customStartDate || '1970-01-01';
            endDateStr = customEndDate || '2099-12-31';
        } else if (selectedMonthValue === 'all_time') {
            startDateStr = '1970-01-01';
            endDateStr = '2099-12-31';
        } else if (selectedMonthValue.includes('-')) {
            const [yyyy, mm] = selectedMonthValue.split('-').map(Number);
            const lastDay = new Date(yyyy, mm, 0).getDate();
            startDateStr = `${selectedMonthValue}-01`;
            endDateStr = `${selectedMonthValue}-${String(lastDay).padStart(2, '0')}`;
        }

        return { startDateStr, endDateStr };
    }, [selectedMonthValue, customStartDate, customEndDate]);

    // Calculate student payment status with O(1) payments map lookup
    const getStudentStatus = useCallback((student: StudentFeesData) => {
        if (student.fees_amount <= 0) return 'setup_required';
        const classesCompleted = student.fees_classes_paid <= 0;
        
        const studentPayments = paymentsMap[student.id] || [];
        const hasPending = studentPayments.some(p => p.status === 'pending_approval');
        if (hasPending) return 'pending_verification';

        if (student.fees_basis === 'class') {
            if (student.fees_classes_paid < 0) return 'overdue';
            if (student.fees_classes_paid === 0) return 'due_classes';
            return 'good';
        }

        if (student.fees_basis === 'monthly' && student.fees_collection_date) {
            const feeStatus = getStudentFeeStatus(
                student.fees_basis,
                Number(student.fees_collection_date),
                studentPayments,
                activePeriodDate,
                student.join_date
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

        // Fallback
        return classesCompleted ? 'due_classes' : 'good';
    }, [paymentsMap, activePeriodDate]);

    const handleHeaderSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setBasisFilter('all');
        setStatusFilter('all');
        setDateFilter('all');
        setClassesLeftFilter('all');
        setAmountFilter('all');
        setCollectionFilter('all');
        setPeriodPaymentFilter('received_only');
        setSelectedMonthValue('current_month');
        setCustomStartDate('');
        setCustomEndDate('');
        setSortField('status');
        setSortOrder('asc');
    };

    const hasActiveFilters = searchQuery !== '' || basisFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all' || classesLeftFilter !== 'all' || amountFilter !== 'all' || collectionFilter !== 'all' || periodPaymentFilter !== 'received_only' || selectedMonthValue !== 'current_month';

    // Filtering & Sorting logic with Memoized Statuses & Period Payment Filters
    const { periodPaymentsMap, filteredStudents } = useMemo(() => {
        const statusMap = new Map<string, string>();
        const nextCollectionMap = new Map<string, number>();
        const periodPaymentsMap = new Map<string, PaymentRecord[]>();

        const { startDateStr, endDateStr } = periodDateRange;

        students.forEach(s => {
            statusMap.set(s.id, getStudentStatus(s));

            const studentPayments = paymentsMap[s.id] || [];
            const inPeriod = studentPayments.filter(p => {
                const pDate = p.payment_date ? p.payment_date.split('T')[0] : '';
                return pDate >= startDateStr && pDate <= endDateStr;
            }).sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));

            periodPaymentsMap.set(s.id, inPeriod);

            let ts = 9999999999999;
            if (s.fees_amount > 0) {
                if (s.fees_basis === 'monthly' && s.fees_collection_date) {
                    const feeStatus = getStudentFeeStatus(
                        s.fees_basis,
                        Number(s.fees_collection_date),
                        studentPayments
                    );
                    if (feeStatus && feeStatus.dueDate) {
                        ts = feeStatus.dueDate.getTime();
                    }
                } else if (s.join_date) {
                    const joinD = new Date(s.join_date);
                    joinD.setDate(joinD.getDate() + 30);
                    ts = joinD.getTime();
                }
            }
            nextCollectionMap.set(s.id, ts);
        });

        let result = [...students];

        // Apply Received in Period filter if periodPaymentFilter is 'received_only'
        // AND statusFilter is 'all' (or 'good'), so specific status tabs like 'setup_required' or 'overdue_due' display their full list.
        const isSpecificStatusTab = statusFilter === 'setup_required' || statusFilter === 'overdue_due' || statusFilter === 'pending_verification';

        if (selectedMonthValue !== 'all_time' && periodPaymentFilter === 'received_only' && !isSpecificStatusTab) {
            result = result.filter(s => (periodPaymentsMap.get(s.id)?.length || 0) > 0);
        }

        if (searchQuery.trim() !== '') {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(s => s.name.toLowerCase().includes(lowerQuery) || (s.batch_name || '').toLowerCase().includes(lowerQuery));
        }

        if (basisFilter !== 'all') {
            result = result.filter(s => s.fees_basis === basisFilter);
        }

        if (statusFilter !== 'all') {
            if (statusFilter === 'overdue_due') {
                result = result.filter(s => {
                    const status = statusMap.get(s.id);
                    return status === 'overdue' || status === 'due_classes' || status === 'due_date';
                });
            } else {
                result = result.filter(s => statusMap.get(s.id) === statusFilter);
            }
        }

        if (dateFilter !== 'all') {
            const now = new Date().getTime();
            result = result.filter(s => {
                if (!s.join_date) return false;
                const jTime = new Date(s.join_date).getTime();
                if (dateFilter === '30days') return (now - jTime) <= 30 * 86400000;
                if (dateFilter === '90days') return (now - jTime) <= 90 * 86400000;
                if (dateFilter === '2026') return new Date(s.join_date).getFullYear() === 2026;
                return true;
            });
        }

        if (classesLeftFilter !== 'all') {
            result = result.filter(s => {
                if (classesLeftFilter === 'zero' || classesLeftFilter === '0') return s.fees_classes_paid <= 0;
                if (classesLeftFilter === 'one' || classesLeftFilter === '1') return s.fees_classes_paid === 1;
                if (classesLeftFilter === '2') return s.fees_classes_paid === 2;
                if (classesLeftFilter === '3') return s.fees_classes_paid === 3;
                if (classesLeftFilter === '4') return s.fees_classes_paid === 4;
                if (classesLeftFilter === '5') return s.fees_classes_paid === 5;
                if (classesLeftFilter === '6+') return s.fees_classes_paid >= 6;
                if (classesLeftFilter === 'multiple') return s.fees_classes_paid > 1;
                return true;
            });
        }

        if (amountFilter !== 'all') {
            result = result.filter(s => {
                if (amountFilter === 'configured') return s.fees_amount > 0;
                if (amountFilter === 'unconfigured') return s.fees_amount <= 0;
                return true;
            });
        }

        if (collectionFilter !== 'all') {
            const now = new Date().getTime();
            result = result.filter(s => {
                const ts = nextCollectionMap.get(s.id) || 9999999999999;
                if (collectionFilter === 'due') return ts <= now;
                if (collectionFilter === 'next7') return ts > now && ts <= now + 7 * 86400000;
                if (collectionFilter === 'next30') return ts > now && ts <= now + 30 * 86400000;
                return true;
            });
        }

        const statusPriority: Record<string, number> = { overdue: 0, due_classes: 1, due_date: 2, pending_verification: 3, setup_required: 4, good: 5 };

        const sorted = result.sort((a, b) => {
            let comparison = 0;

            if (sortField === 'name') {
                comparison = a.name.localeCompare(b.name);
            } else if (sortField === 'join_date') {
                const dA = a.join_date ? new Date(a.join_date).getTime() : 0;
                const dB = b.join_date ? new Date(b.join_date).getTime() : 0;
                comparison = dA - dB;
            } else if (sortField === 'fees_basis') {
                comparison = a.fees_basis.localeCompare(b.fees_basis);
            } else if (sortField === 'fees_classes_paid') {
                comparison = a.fees_classes_paid - b.fees_classes_paid;
            } else if (sortField === 'next_collection') {
                const tA = nextCollectionMap.get(a.id) || 9999999999999;
                const tB = nextCollectionMap.get(b.id) || 9999999999999;
                comparison = tA - tB;
            } else if (sortField === 'latest_payment') {
                const pA = periodPaymentsMap.get(a.id)?.[0];
                const pB = periodPaymentsMap.get(b.id)?.[0];
                const tA = pA?.payment_date ? new Date(pA.payment_date).getTime() : 0;
                const tB = pB?.payment_date ? new Date(pB.payment_date).getTime() : 0;
                comparison = tA - tB;
            } else if (sortField === 'fees_amount') {
                comparison = a.fees_amount - b.fees_amount;
            } else if (sortField === 'status') {
                const pA = statusPriority[statusMap.get(a.id) || 'good'] ?? 5;
                const pB = statusPriority[statusMap.get(b.id) || 'good'] ?? 5;
                comparison = pA - pB;
            }

            if (comparison !== 0) {
                return sortOrder === 'asc' ? comparison : -comparison;
            }
            return a.name.localeCompare(b.name);
        });

        return { periodPaymentsMap, filteredStudents: sorted };
    }, [students, searchQuery, statusFilter, basisFilter, dateFilter, classesLeftFilter, amountFilter, collectionFilter, sortField, sortOrder, getStudentStatus, paymentsMap, periodDateRange, selectedMonthValue, periodPaymentFilter]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredStudents.length / ITEMS_PER_PAGE));
    const paginatedStudents = useMemo(() => {
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredStudents.slice(from, from + ITEMS_PER_PAGE);
    }, [filteredStudents, currentPage]);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, basisFilter, dateFilter, classesLeftFilter, amountFilter, collectionFilter, sortField, sortOrder, selectedMonthValue, periodPaymentFilter]);

    // Statistics & Period Payment Filter
    const statsSummary = useMemo(() => {
        const { startDateStr, endDateStr } = periodDateRange;

        const filteredPaymentsInPeriod = payments.filter(p => {
            const pDate = p.payment_date ? p.payment_date.split('T')[0] : '';
            return pDate >= startDateStr && pDate <= endDateStr;
        });

        const totalCollected = filteredPaymentsInPeriod.reduce((acc, curr) => acc + Number(curr.amount), 0);

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
            filteredPaymentsCount: filteredPaymentsInPeriod.length,
            startDateStr,
            endDateStr,
            overdueCount,
            dueClassesCount,
            dueDateCount,
            goodCount,
            setupCount,
            pendingCount,
            totalStudents: students.length
        };
    }, [students, payments, periodDateRange, getStudentStatus]);

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
        setClassesAdded(student.fees_basis === 'class' ? '1' : '4');
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
            // For class-basis: payment books/covers 1 class in advance (does not endlessly accumulate to 2, 3...)
            const newClassesPaid = selectedStudent.fees_basis === 'class'
                ? Math.min(cls, Math.max(0, selectedStudent.fees_classes_paid) + cls)
                : selectedStudent.fees_classes_paid + cls;
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

    // Send Reminder Notification & Direct Message to Student
    const handleSendReminder = async (student: StudentFeesData, type: 'due_date' | 'classes_completed') => {
        try {
            const currentUser = (await supabaseAuth.auth.getUser()).data.user;
            const senderId = teacherProfile?.id || currentUser?.id;
            const reminderMessage = type === 'classes_completed' 
                ? 'Fee Due Reminder: Your prepaid classes balance is complete. Please submit your fee payment.' 
                : 'Fee Due Reminder: Your monthly fee payment is due. Please submit your fee payment.';

            // 1. Insert record in fees_notifications for history logs
            const { error: logErr } = await supabaseAuth
                .from('fees_notifications')
                .insert([{
                    student_id: student.id,
                    notification_type: type,
                    channel: 'in_app',
                    status: 'sent'
                }]);

            if (logErr) throw logErr;

            // 2. Send Direct Message to student (stored in messages table)
            if (senderId) {
                const { error: msgErr } = await supabaseAuth.from('messages').insert({
                    sender_id: senderId,
                    receiver_id: student.id,
                    message_text: reminderMessage,
                    status: 'sent',
                    created_at: new Date().toISOString()
                });
                if (msgErr) throw msgErr;
            }

            // 3. Insert notification in public.notifications for student header notification & Fee tab alert
            const { error: notifErr } = await supabaseAuth.from('notifications').insert({
                user_id: student.id,
                title: type === 'classes_completed' ? 'Fees Due: Prepaid Classes Completed' : 'Fees Due: Monthly Billing Reminder',
                message: reminderMessage,
                type: 'fees',
                is_read: false
            });
            if (notifErr) throw notifErr;

            setAlertMessage({ 
                type: 'success', 
                text: `Fee reminder and message sent successfully to ${student.name}! Stored in student's Fee & Payments section.` 
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
            const errDetail = err?.message || err?.details || err?.error_description || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            console.error('Error sending reminder:', errDetail, err);
            setAlertMessage({ type: 'error', text: `Failed to send reminder: ${errDetail}` });
        }
    };

    const handleApprovePayment = async (paymentId: string, studentId: string, amount: number, basis: string) => {
        try {
            const student = students.find(s => s.id === studentId);
            const studentFeesAmount = student ? student.fees_amount : (selectedStudent?.fees_amount || 0);
            const studentFeesBasis = student ? student.fees_basis : (selectedStudent?.fees_basis || basis || 'monthly');
            const classesToAdd = calculateClassesAdded(amount, studentFeesAmount, studentFeesBasis);

            // Update payment status
            const { error: paymentError } = await supabaseAuth
                .from('fees_payments')
                .update({ status: 'approved', classes_added: classesToAdd })
                .eq('id', paymentId);
            
            if (paymentError) throw paymentError;

            // Update student balance
            const currentClasses = student ? student.fees_classes_paid : (selectedStudent?.fees_classes_paid || 0);
            const newClassesPaid = studentFeesBasis === 'class'
                ? Math.min(classesToAdd, Math.max(0, currentClasses) + classesToAdd)
                : currentClasses + classesToAdd;
            
            const { error: studentUpdateError } = await supabaseAuth
                .from('users')
                .update({ fees_classes_paid: newClassesPaid })
                .eq('id', studentId);
            
            if (studentUpdateError) throw studentUpdateError;
            
            if (selectedStudent && selectedStudent.id === studentId) {
                setSelectedStudent({ ...selectedStudent, fees_classes_paid: newClassesPaid });
            }

            // Auto-mark previous fee due reminders as read for this student upon payment approval
            await supabaseAuth
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', studentId)
                .or('type.eq.fee_reminder,type.eq.fees');

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

    const handleDeletePayment = async (pay: PaymentRecord) => {
        if (!selectedStudent) return;

        const confirmMsg = `Are you sure you want to remove this fee payment record of ₹${pay.amount}? This will delete the payment record and deduct ${pay.classes_added || 0} classes from ${selectedStudent.name}'s balance.`;
        if (!window.confirm(confirmMsg)) return;

        setIsDeletingPayment(pay.id);
        try {
            // 1. Delete payment record from fees_payments
            const { error: deleteError } = await supabaseAuth
                .from('fees_payments')
                .delete()
                .eq('id', pay.id);

            if (deleteError) throw deleteError;

            // 2. Adjust student balance in users table (deduct classes added by this payment)
            const currentClasses = selectedStudent.fees_classes_paid || 0;
            const classesToDeduct = pay.status === 'rejected' ? 0 : (pay.classes_added || 0);
            const newClassesPaid = Math.max(0, currentClasses - classesToDeduct);

            const { error: userUpdateError } = await supabaseAuth
                .from('users')
                .update({ fees_classes_paid: newClassesPaid })
                .eq('id', selectedStudent.id);

            if (userUpdateError) throw userUpdateError;

            // 3. Update local state
            setSelectedStudent(prev => prev ? { ...prev, fees_classes_paid: newClassesPaid } : null);
            setStudentPayments(prev => prev.filter(p => p.id !== pay.id));
            setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, fees_classes_paid: newClassesPaid } : s));

            setAlertMessage({
                type: 'success',
                text: `Fee record (₹${pay.amount}) removed successfully and ${classesToDeduct} classes deducted.`
            });

            // 4. Refresh global data
            fetchData();
        } catch (err: any) {
            console.error('Error removing fee payment record:', err);
            setAlertMessage({ type: 'error', text: `Failed to remove payment record: ${err.message || err}` });
        } finally {
            setIsDeletingPayment(null);
        }
    };

    return (
        <div className="bg-[#f8f8f6] dark:bg-[#221d10] text-slate-900 dark:text-slate-100 font-sans min-h-screen">
            <div className="flex h-screen overflow-hidden">
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

                <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
                    <TeacherHeader 
                        title="Fees Management" 
                        avatarUrl={teacherProfile?.profile_pic_url}
                        userName={teacherProfile?.name}
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
                                <div className="flex items-center gap-3 shrink-0">
                                    <button
                                        onClick={() => {
                                            const statusTextMap: Record<string, string> = {
                                                overdue: 'Overdue',
                                                due_classes: 'Classes Expired',
                                                due_date: 'Due Today',
                                                pending_verification: 'Pending Review',
                                                setup_required: 'Setup Required',
                                                good: 'Good Standing'
                                            };
                                            const { startDateStr, endDateStr } = statsSummary;
                                            const studentsForExport = students.map(s => {
                                                const studentPaymentsInPeriod = payments.filter(p => {
                                                    if (p.student_id !== s.id) return false;
                                                    const pDate = p.payment_date ? p.payment_date.split('T')[0] : '';
                                                    return pDate >= startDateStr && pDate <= endDateStr;
                                                });
                                                const collectedInPeriod = studentPaymentsInPeriod.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                                                return {
                                                    ...s,
                                                    statusLabel: statusTextMap[getStudentStatus(s)] || 'Good Standing',
                                                    collectedInPeriod
                                                };
                                            });
                                            exportFeesCSV(studentsForExport, periodDisplayTitle);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-[#ecb613] hover:bg-[#d9a40e] text-slate-950 font-black rounded-xl text-xs shadow-sm transition-all cursor-pointer border border-[#d9a40e] shrink-0"
                                        title="Export Fees Report to CSV File"
                                    >
                                        <Download className="size-4" />
                                        <span>Export CSV Report</span>
                                    </button>
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
                            </div>

                            {/* Fee Period / Month Selector Bar */}
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-[#b45309] dark:text-[#ecb613] flex items-center justify-center shrink-0">
                                        <Calendar className="size-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Active Fee Period</p>
                                        <h3 className="text-sm font-black text-slate-900 dark:text-white capitalize">{periodDisplayTitle}</h3>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2.5">
                                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">Select Period:</span>
                                        <select
                                            value={selectedMonthValue}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setSelectedMonthValue(val);
                                                if (val === 'all_time') {
                                                    setPeriodPaymentFilter('all');
                                                } else {
                                                    setPeriodPaymentFilter('received_only');
                                                }
                                            }}
                                            className="bg-transparent border-none text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer pr-6"
                                        >
                                            <option value="current_month">Current Month ({new Date().toLocaleDateString('en-US', { month: 'short' })})</option>
                                            {monthOptions
                                                .filter(m => {
                                                    const now = new Date();
                                                    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                                                    return m.value !== currentKey;
                                                })
                                                .map(m => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            <option value="custom_range">Custom Date Range...</option>
                                            <option value="all_time">All Time</option>
                                        </select>
                                    </div>

                                    {selectedMonthValue === 'custom_range' && (
                                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1 text-xs animate-in fade-in duration-200">
                                            <input
                                                type="date"
                                                value={customStartDate}
                                                onChange={e => setCustomStartDate(e.target.value)}
                                                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                            />
                                            <span className="text-slate-400 font-bold">to</span>
                                            <input
                                                type="date"
                                                value={customEndDate}
                                                onChange={e => setCustomEndDate(e.target.value)}
                                                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-5">
                                    <div className="size-12 rounded-xl bg-kfa-gold-100 dark:bg-kfa-gold-800/30 flex items-center justify-center text-kfa-gold dark:text-kfa-gold-dark">
                                        <DollarSign className="size-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide truncate max-w-[170px]" title={`Collected in ${periodDisplayTitle}`}>
                                            Collected ({periodDisplayTitle})
                                        </p>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">₹{statsSummary.totalCollected.toLocaleString('en-IN')}</p>
                                        <p className="text-[10px] font-semibold text-slate-400 mt-1">
                                            {statsSummary.filteredPaymentsCount} payment{statsSummary.filteredPaymentsCount !== 1 ? 's' : ''} in period
                                        </p>
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

                                {/* Filters & Sorting Panel */}
                                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-900/40">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        {/* Search */}
                                        <div className="relative flex-1 max-w-md">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                            <input
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] outline-none transition-all"
                                                placeholder="Search by student name or batch..."
                                                type="text"
                                            />
                                        </div>
                                        
                                        {/* Sort indicator & Reset button */}
                                        <div className="flex items-center gap-3">
                                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:block">
                                                Sorting by: <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">{sortField.replace('_', ' ')} ({sortOrder.toUpperCase()})</span>
                                            </div>
                                            {hasActiveFilters && (
                                                <button
                                                    onClick={handleResetFilters}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-bold transition-all border border-rose-200 dark:border-rose-800 shrink-0"
                                                >
                                                    <span className="material-symbols-outlined text-base">restart_alt</span>
                                                    Reset Filters
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Multi-Column Filter Dropdowns */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                                        {/* Filter: Period Received Payments */}
                                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Period:</span>
                                            <select
                                                value={periodPaymentFilter}
                                                onChange={e => setPeriodPaymentFilter(e.target.value as any)}
                                                className="bg-transparent border-none text-xs font-bold py-1 pl-1 pr-6 focus:ring-0 outline-none cursor-pointer w-full text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="received_only">Received in Period Only</option>
                                                <option value="all">All Active Students</option>
                                            </select>
                                        </div>

                                        {/* Filter: Billing Plan */}
                                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Plan:</span>
                                            <select
                                                value={basisFilter}
                                                onChange={e => setBasisFilter(e.target.value as any)}
                                                className="bg-transparent border-none text-xs font-bold py-1 pl-1 pr-6 focus:ring-0 outline-none cursor-pointer w-full text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="all">All Plans</option>
                                                <option value="monthly">Monthly</option>
                                                <option value="class">Class Basis</option>
                                            </select>
                                        </div>

                                        {/* Filter: Prepaid Classes Left */}
                                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Classes:</span>
                                            <select
                                                value={classesLeftFilter}
                                                onChange={e => setClassesLeftFilter(e.target.value)}
                                                className="bg-transparent border-none text-xs font-bold py-1 pl-1 pr-6 focus:ring-0 outline-none cursor-pointer w-full text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="all">All Balances</option>
                                                <option value="0">0 Classes Left</option>
                                                <option value="1">1 Class Left</option>
                                                <option value="2">2 Classes Left</option>
                                                <option value="3">3 Classes Left</option>
                                                <option value="4">4 Classes Left</option>
                                                <option value="5">5 Classes Left</option>
                                                <option value="6+">6+ Classes Left</option>
                                            </select>
                                        </div>

                                        {/* Filter: Next Collection */}
                                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Due:</span>
                                            <select
                                                value={collectionFilter}
                                                onChange={e => setCollectionFilter(e.target.value)}
                                                className="bg-transparent border-none text-xs font-bold py-1 pl-1 pr-6 focus:ring-0 outline-none cursor-pointer w-full text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="all">All Dates</option>
                                                <option value="due">Due / Overdue Today</option>
                                                <option value="next7">Next 7 Days</option>
                                                <option value="next30">Next 30 Days</option>
                                            </select>
                                        </div>

                                        {/* Filter: Standard Amount */}
                                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Amount:</span>
                                            <select
                                                value={amountFilter}
                                                onChange={e => setAmountFilter(e.target.value)}
                                                className="bg-transparent border-none text-xs font-bold py-1 pl-1 pr-6 focus:ring-0 outline-none cursor-pointer w-full text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="all">All Amounts</option>
                                                <option value="configured">Configured (&gt; ₹0)</option>
                                                <option value="unconfigured">Setup Required (₹0)</option>
                                            </select>
                                        </div>

                                        {/* Filter: Joining Date */}
                                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Joined:</span>
                                            <select
                                                value={dateFilter}
                                                onChange={e => setDateFilter(e.target.value)}
                                                className="bg-transparent border-none text-xs font-bold py-1 pl-1 pr-6 focus:ring-0 outline-none cursor-pointer w-full text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="all">All Dates</option>
                                                <option value="30days">Last 30 Days</option>
                                                <option value="90days">Last 90 Days</option>
                                                <option value="2026">Year 2026</option>
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
                                                            <span className="font-semibold text-slate-700 dark:text-slate-350">{student.fees_basis === 'monthly' ? 'Monthly' : 'Class Basis'}</span>
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
                                                        {(() => {
                                                            const inPeriod = periodPaymentsMap.get(student.id) || [];
                                                            const latestP = inPeriod[0];
                                                            if (latestP) {
                                                                return (
                                                                    <div className="p-2 bg-emerald-50/80 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900/30 col-span-2">
                                                                        <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Received in {periodDisplayTitle}</span>
                                                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                                                            {new Date(latestP.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — ₹{Number(latestP.amount).toLocaleString('en-IN')} ({latestP.payment_method})
                                                                        </span>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
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
                                    <table className="w-full min-w-[1250px] border-collapse text-left">
                                        <thead className="bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 select-none">
                                            <tr className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                                                {/* STUDENT */}
                                                <th 
                                                    onClick={() => handleHeaderSort('name')}
                                                    className="px-6 py-2.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors whitespace-nowrap min-w-[220px] w-[260px]"
                                                    title="Click to sort by Student Name"
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={sortField === 'name' ? 'text-[#b45309] dark:text-[#ecb613] font-black' : ''}>Student</span>
                                                        <span className="text-xs">
                                                            {sortField === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                                                        </span>
                                                    </div>
                                                </th>

                                                {/* JOINING DATE */}
                                                <th 
                                                    onClick={() => handleHeaderSort('join_date')}
                                                    className="px-6 py-2.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors whitespace-nowrap"
                                                    title="Click to sort by Joining Date"
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={sortField === 'join_date' ? 'text-[#b45309] dark:text-[#ecb613] font-black' : ''}>Joining Date</span>
                                                        <span className="text-xs">
                                                            {sortField === 'join_date' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                                                        </span>
                                                    </div>
                                                </th>

                                                {/* PAYMENT RECEIVED IN PERIOD */}
                                                <th 
                                                    onClick={() => handleHeaderSort('latest_payment')}
                                                    className="px-6 py-2.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors whitespace-nowrap"
                                                    title="Click to sort by Received Payment Date in Selected Period"
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={sortField === 'latest_payment' ? 'text-[#b45309] dark:text-[#ecb613] font-black' : ''}>Payment Received</span>
                                                        <span className="text-xs">
                                                            {sortField === 'latest_payment' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                                                        </span>
                                                    </div>
                                                </th>

                                                {/* BILLING PLAN */}
                                                <th 
                                                    onClick={() => handleHeaderSort('fees_basis')}
                                                    className="px-6 py-2.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors whitespace-nowrap"
                                                    title="Click to sort by Billing Plan"
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={sortField === 'fees_basis' ? 'text-[#b45309] dark:text-[#ecb613] font-black' : ''}>Billing Plan</span>
                                                        <span className="text-xs">
                                                            {sortField === 'fees_basis' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                                                        </span>
                                                    </div>
                                                </th>

                                                {/* PREPAID CLASSES */}
                                                <th 
                                                    onClick={() => handleHeaderSort('fees_classes_paid')}
                                                    className="px-6 py-2.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors whitespace-nowrap"
                                                    title="Click to sort by Prepaid Classes Left"
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={sortField === 'fees_classes_paid' ? 'text-[#b45309] dark:text-[#ecb613] font-black' : ''}>Prepaid Classes</span>
                                                        <span className="text-xs">
                                                            {sortField === 'fees_classes_paid' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                                                        </span>
                                                    </div>
                                                </th>

                                                {/* NEXT COLLECTION */}
                                                <th 
                                                    onClick={() => handleHeaderSort('next_collection')}
                                                    className="px-6 py-2.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors whitespace-nowrap"
                                                    title="Click to sort by Next Collection Date"
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={sortField === 'next_collection' ? 'text-[#b45309] dark:text-[#ecb613] font-black' : ''}>Next Collection</span>
                                                        <span className="text-xs">
                                                            {sortField === 'next_collection' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                                                        </span>
                                                    </div>
                                                </th>

                                                {/* STANDARD AMOUNT */}
                                                <th 
                                                    onClick={() => handleHeaderSort('fees_amount')}
                                                    className="px-6 py-2.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors whitespace-nowrap"
                                                    title="Click to sort by Standard Amount"
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={sortField === 'fees_amount' ? 'text-[#b45309] dark:text-[#ecb613] font-black' : ''}>Standard Amount</span>
                                                        <span className="text-xs">
                                                            {sortField === 'fees_amount' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                                                        </span>
                                                    </div>
                                                </th>

                                                {/* STATUS */}
                                                <th 
                                                    onClick={() => handleHeaderSort('status')}
                                                    className="px-6 py-2.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors whitespace-nowrap"
                                                    title="Click to sort by Fee Status"
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={sortField === 'status' ? 'text-[#b45309] dark:text-[#ecb613] font-black' : ''}>Status</span>
                                                        <span className="text-xs">
                                                            {sortField === 'status' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                                                        </span>
                                                    </div>
                                                </th>

                                                {/* ACTIONS */}
                                                <th className="px-6 py-2.5 text-right whitespace-nowrap">Actions</th>
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
                                                            <td className="px-6 py-2.5 min-w-[220px] w-[260px]">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="size-8 rounded-lg bg-[#ecb613]/10 text-[#ecb613] font-bold flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800 shrink-0">
                                                                        {student.profile_pic_url ? (
                                                                            <img src={student.profile_pic_url} alt="" className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <span>{student.name.charAt(0)}</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight whitespace-nowrap">{student.name}</p>
                                                                        <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate max-w-[200px]" title={student.batch_name === 'Unassigned' ? 'No Batch' : student.batch_name}>
                                                                            {student.batch_name === 'Unassigned' ? 'No Batch' : student.batch_name}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Joining Date */}
                                                            <td className="px-6 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                                {student.join_date ? new Date(student.join_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                                            </td>

                                                            {/* Payment Received Date (In Period) */}
                                                            <td className="px-6 py-2.5 text-xs whitespace-nowrap">
                                                                {(() => {
                                                                    const inPeriod = periodPaymentsMap.get(student.id) || [];
                                                                    const latestP = inPeriod[0];
                                                                    if (latestP) {
                                                                        return (
                                                                            <div>
                                                                                <p className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 leading-tight">
                                                                                    <Check className="size-3 text-emerald-500" />
                                                                                    {new Date(latestP.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                                </p>
                                                                                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                                                                                    ₹{Number(latestP.amount).toLocaleString('en-IN')} ({latestP.payment_method})
                                                                                </p>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return <span className="text-slate-400 italic text-[11px]">No payment in period</span>;
                                                                })()}
                                                            </td>

                                                            {/* Billing Plan */}
                                                            <td className="px-6 py-2.5">
                                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                                                                    student.fees_basis === 'monthly'
                                                                        ? 'bg-purple-50 dark:bg-purple-950/20 text-purple-750 border border-purple-100 dark:border-purple-900/30'
                                                                        : 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 border border-indigo-100 dark:border-indigo-900/30'
                                                                }`}>
                                                                    {student.fees_basis === 'monthly' ? 'Monthly' : 'Class Basis'}
                                                                </span>
                                                            </td>

                                                            {/* Prepaid Classes Balance */}
                                                            <td className="px-6 py-2.5 whitespace-nowrap">
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
                                                            <td className="px-6 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-350 whitespace-nowrap">
                                                                {(() => {
                                                                    if (student.fees_amount <= 0) return <span className="text-slate-400 italic font-medium text-[10px]">Setup Required</span>;
                                                                    
                                                                    if (student.fees_basis === 'monthly') {
                                                                        if (student.fees_collection_date) {
                                                                            const studentPayments = paymentsMap[student.id] || [];
                                                                            const feeStatus = getStudentFeeStatus(
                                                                                student.fees_basis,
                                                                                Number(student.fees_collection_date),
                                                                                studentPayments,
                                                                                activePeriodDate,
                                                                                student.join_date
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
                                                            <td className="px-6 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                                                ₹{student.fees_amount.toLocaleString('en-IN')}
                                                            </td>

                                                            {/* Status Badge */}
                                                            <td className="px-6 py-2.5 whitespace-nowrap">
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
                                                            <td className="px-6 py-2.5 text-right whitespace-nowrap">
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
                                        <span>Showing {filteredStudents.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length)} of {filteredStudents.length} Students</span>
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
                                                                    <button
                                                                        disabled={isDeletingPayment === pay.id}
                                                                        onClick={() => handleDeletePayment(pay)}
                                                                        title="Remove/Delete this fee payment record"
                                                                        className="p-1 px-2 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 transition-colors flex items-center gap-1 text-[10px] font-bold"
                                                                    >
                                                                        {isDeletingPayment === pay.id ? (
                                                                            <Loader2 className="size-3 animate-spin text-rose-600" />
                                                                        ) : (
                                                                            <Trash2 className="size-3" />
                                                                        )}
                                                                        <span>Remove</span>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-3">
                                                                    <div className="text-right">
                                                                        {pay.status !== 'rejected' && (
                                                                            <p className="font-bold text-slate-700 dark:text-slate-300">+{pay.classes_added} classes</p>
                                                                        )}
                                                                        <p className="text-[9px] text-slate-400 mt-0.5">
                                                                            Paid on {new Date(pay.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        disabled={isDeletingPayment === pay.id}
                                                                        onClick={() => handleDeletePayment(pay)}
                                                                        title="Remove/Delete this fee payment record"
                                                                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                                                                    >
                                                                        {isDeletingPayment === pay.id ? (
                                                                            <Loader2 className="size-3.5 animate-spin text-rose-600" />
                                                                        ) : (
                                                                            <Trash2 className="size-3.5" />
                                                                        )}
                                                                        <span>Remove</span>
                                                                    </button>
                                                                </div>
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
