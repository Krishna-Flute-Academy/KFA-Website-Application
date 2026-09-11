'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, 
    Calendar, 
    Clock, 
    CreditCard, 
    CheckCircle2, 
    AlertCircle, 
    Loader2, 
    School, 
    User, 
    ArrowRight, 
    Check, 
    RotateCcw,
    Sparkles,
    CalendarDays,
    Percent
} from 'lucide-react';
import { supabaseAuth } from '../../../lib/supabase-auth';
import { getStudentFeeStatus, FeeStatusDetails } from '../../../lib/fee-utils';
import { isStudentPaused } from '../../../lib/student-lifecycle';

export interface StudentAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentId: string | null;
    initialStudentName?: string;
    initialProfilePicUrl?: string;
}

interface StudentProfile {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    profile_pic_url?: string;
    fees_basis?: string;
    fees_collection_date?: number | string;
    fees_amount?: number;
    fees_classes_paid?: number;
    created_at?: string;
    status?: string;
}

interface ClassroomInfo {
    id: string;
    name: string;
    scheduleText?: string;
}

interface AttendanceRecord {
    id: string;
    date: string;
    status: 'present' | 'late' | 'absent' | 'excused';
    classroom_id: string;
    classroom_name: string;
    is_temporary?: boolean;
    sessionType: 'regular' | 'special' | 'guest_makeup';
    makeupDetails?: {
        isMakeupAttended?: boolean;
        makeupForDate?: string;
        missedResolvedByDate?: string;
        missedResolvedInClass?: string;
        missedScheduledDate?: string;
        missedScheduledClass?: string;
    };
}

// Helpers
function getOrdinalSuffix(day: number): string {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1:  return "st";
        case 2:  return "nd";
        case 3:  return "rd";
        default: return "th";
    }
}

function formatLocalDateStr(dateStr: string, includeYear = false, locale = 'en-IN'): string {
    if (!dateStr) return '';
    const cleanDate = dateStr.split('T')[0].split(' ')[0];
    const parts = cleanDate.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return d.toLocaleDateString(locale, { 
        day: 'numeric', 
        month: 'short', 
        ...(includeYear ? { year: 'numeric' } : {}) 
    });
}

function extractMissedDate(reason?: string): string | null {
    if (!reason) return null;
    const match = reason.match(/\[MissedDate:([^\]]+)\]/);
    return match ? match[1] : null;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const StudentAttendanceModal: React.FC<StudentAttendanceModalProps> = ({
    isOpen,
    onClose,
    studentId,
    initialStudentName,
    initialProfilePicUrl
}) => {
    // Date range defaulting to current calendar month
    const [fromDate, setFromDate] = useState<string>(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}-01`;
    });

    const [toDate, setToDate] = useState<string>(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        return `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    });

    const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'late' | 'absent' | 'excused'>('all');

    // Loading & Data States
    const [loading, setLoading] = useState(false);
    const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
    const [permanentClassrooms, setPermanentClassrooms] = useState<ClassroomInfo[]>([]);
    const [feeStatus, setFeeStatus] = useState<FeeStatusDetails | null>(null);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [completedMakeupsCount, setCompletedMakeupsCount] = useState(0);
    const [pendingMakeupsCount, setPendingMakeupsCount] = useState(0);

    // Preset Range Handlers
    const setThisMonth = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        setFromDate(`${y}-${m}-01`);
        setToDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
    };

    const setLastMonth = () => {
        const now = new Date();
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const y = prevMonthDate.getFullYear();
        const m = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(y, prevMonthDate.getMonth() + 1, 0).getDate();
        setFromDate(`${y}-${m}-01`);
        setToDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
    };

    const setLast3Months = () => {
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const yStart = threeMonthsAgo.getFullYear();
        const mStart = String(threeMonthsAgo.getMonth() + 1).padStart(2, '0');
        
        const yEnd = now.getFullYear();
        const mEnd = String(now.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(yEnd, now.getMonth() + 1, 0).getDate();

        setFromDate(`${yStart}-${mStart}-01`);
        setToDate(`${yEnd}-${mEnd}-${String(lastDay).padStart(2, '0')}`);
    };

    // Close on Escape Key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isOpen]);

    // Fetch Student & Attendance Details
    const fetchData = useCallback(async () => {
        if (!studentId || !isOpen) return;
        setLoading(true);

        try {
            // 1. Fetch Student Profile
            const { data: profileData, error: profileErr } = await supabaseAuth
                .from('users')
                .select('id, name, email, phone, profile_pic_url, fees_basis, fees_collection_date, fees_amount, fees_classes_paid, created_at, status')
                .eq('id', studentId)
                .single();

            if (profileErr) {
                console.warn('Could not fetch student profile:', profileErr);
            }
            const profile: StudentProfile = profileData || {
                id: studentId,
                name: initialStudentName || 'Student',
                profile_pic_url: initialProfilePicUrl
            };
            setStudentProfile(profile);

            // 2. Fetch Payments to derive Fee Due status using canonical getStudentFeeStatus
            const { data: paymentsData } = await supabaseAuth
                .from('fees_payments')
                .select('id, student_id, payment_date, amount, status, created_at')
                .eq('student_id', studentId)
                .order('payment_date', { ascending: false });

            const derivedFeeStatus = getStudentFeeStatus(
                profile.fees_basis,
                profile.fees_collection_date ? Number(profile.fees_collection_date) : undefined,
                paymentsData || [],
                new Date(),
                profile.created_at,
                profile.status
            );
            setFeeStatus(derivedFeeStatus);

            // 3. Fetch Permanent Classroom(s) & Batch Schedules
            const { data: enrollments } = await supabaseAuth
                .from('classroom_students')
                .select('classroom_id, classrooms(id, name)')
                .eq('student_id', studentId);

            const classroomList: ClassroomInfo[] = [];
            if (enrollments && enrollments.length > 0) {
                for (const enr of enrollments) {
                    const c = (enr as any).classrooms;
                    if (!c) continue;

                    // Fetch batch schedules for this classroom
                    const { data: schedules } = await supabaseAuth
                        .from('batch_schedules')
                        .select('day_of_week, start_time, end_time')
                        .eq('classroom_id', c.id);

                    let scheduleText = '';
                    if (schedules && schedules.length > 0) {
                        scheduleText = schedules.map(s => {
                            const dayName = DAYS_OF_WEEK[s.day_of_week] || `Day ${s.day_of_week}`;
                            const formatTime = (t: string) => {
                                if (!t) return '';
                                const [h, min] = t.split(':');
                                const hour = parseInt(h, 10);
                                const ampm = hour >= 12 ? 'PM' : 'AM';
                                const h12 = hour % 12 || 12;
                                return `${h12}:${min} ${ampm}`;
                            };
                            return `${dayName} ${formatTime(s.start_time)}`;
                        }).join(', ');
                    }

                    classroomList.push({
                        id: c.id,
                        name: c.name,
                        scheduleText: scheduleText || undefined
                    });
                }
            }
            setPermanentClassrooms(classroomList);

            // 4. Fetch All Classrooms and Temporary Classes to resolve names
            const [classroomsRes, tempClassesRes] = await Promise.all([
                supabaseAuth.from('classrooms').select('id, name'),
                supabaseAuth.from('temporary_classes').select('id, title, session_date')
            ]);

            const classroomNameMap = new Map<string, string>();
            const isTempClassMap = new Map<string, boolean>();
            (classroomsRes.data || []).forEach(c => classroomNameMap.set(c.id, c.name));
            (tempClassesRes.data || []).forEach(t => {
                classroomNameMap.set(t.id, t.title);
                isTempClassMap.set(t.id, true);
            });

            // 5. Fetch ALL student overrides (for cross-referencing makeups across all dates)
            const { data: allOverrides } = await supabaseAuth
                .from('session_student_overrides')
                .select('id, target_classroom_id, override_date, reason')
                .eq('student_id', studentId);

            const overridesList = allOverrides || [];

            // 6. Fetch Attendance Records in the Selected Date Range
            const { data: attendanceData, error: attErr } = await supabaseAuth
                .from('attendance')
                .select('id, date, status, classroom_id')
                .eq('student_id', studentId)
                .gte('date', fromDate)
                .lte('date', toDate)
                .order('date', { ascending: false });

            if (attErr) throw attErr;

            // Also fetch attendance on all override dates to see if makeups were attended
            const overrideDates = overridesList.map(o => o.override_date.split('T')[0].split(' ')[0]);
            let overrideAttendanceMap = new Map<string, string>(); // `${override_date}_${target_classroom_id}` -> status
            if (overrideDates.length > 0) {
                const { data: ovAtt } = await supabaseAuth
                    .from('attendance')
                    .select('date, status, classroom_id')
                    .eq('student_id', studentId)
                    .in('date', overrideDates);

                (ovAtt || []).forEach(a => {
                    const key = `${a.date.split('T')[0].split(' ')[0]}_${a.classroom_id}`;
                    overrideAttendanceMap.set(key, a.status);
                });
            }

            // Build Attendance Records with Makeup Relationship Tracking
            const records: AttendanceRecord[] = [];
            let completedMakeups = 0;
            let pendingMakeups = 0;

            (attendanceData || []).forEach((att) => {
                const cleanDate = att.date.split('T')[0].split(' ')[0];
                const cName = classroomNameMap.get(att.classroom_id) || 'Classroom';
                const isTemp = isTempClassMap.get(att.classroom_id) || false;

                // Check if this attendance matches a student override
                const matchingOverride = overridesList.find(o => {
                    const oDate = o.override_date.split('T')[0].split(' ')[0];
                    return oDate === cleanDate && o.target_classroom_id === att.classroom_id;
                });

                let sessionType: 'regular' | 'special' | 'guest_makeup' = isTemp ? 'special' : 'regular';
                let makeupDetails: AttendanceRecord['makeupDetails'] = {};

                if (matchingOverride) {
                    sessionType = 'guest_makeup';
                    const missedDate = extractMissedDate(matchingOverride.reason);
                    makeupDetails.isMakeupAttended = true;
                    makeupDetails.makeupForDate = missedDate || undefined;
                    if (att.status === 'present' || att.status === 'late') {
                        completedMakeups++;
                    }
                }

                // If missed (absent or excused), find if a makeup was scheduled or completed
                if (att.status === 'absent' || att.status === 'excused') {
                    // Look for an override referencing this date in its reason
                    const scheduledMakeup = overridesList.find(o => {
                        const mDate = extractMissedDate(o.reason);
                        return mDate === cleanDate;
                    });

                    if (scheduledMakeup) {
                        const sDate = scheduledMakeup.override_date.split('T')[0].split(' ')[0];
                        const targetName = classroomNameMap.get(scheduledMakeup.target_classroom_id) || 'Classroom';
                        const ovStatus = overrideAttendanceMap.get(`${sDate}_${scheduledMakeup.target_classroom_id}`);

                        if (ovStatus === 'present' || ovStatus === 'late') {
                            makeupDetails.missedResolvedByDate = sDate;
                            makeupDetails.missedResolvedInClass = targetName;
                        } else {
                            makeupDetails.missedScheduledDate = sDate;
                            makeupDetails.missedScheduledClass = targetName;
                            pendingMakeups++;
                        }
                    } else {
                        pendingMakeups++;
                    }
                }

                records.push({
                    id: att.id,
                    date: cleanDate,
                    status: att.status as any,
                    classroom_id: att.classroom_id,
                    classroom_name: cName,
                    is_temporary: isTemp,
                    sessionType,
                    makeupDetails
                });
            });

            setAttendanceRecords(records);
            setCompletedMakeupsCount(completedMakeups);
            setPendingMakeupsCount(pendingMakeups);
        } catch (error) {
            console.error('Error fetching student attendance details:', error);
        } finally {
            setLoading(false);
        }
    }, [studentId, isOpen, fromDate, toDate, initialStudentName, initialProfilePicUrl]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Computed Summary Metrics
    const metrics = useMemo(() => {
        const total = attendanceRecords.length;
        const present = attendanceRecords.filter(r => r.status === 'present').length;
        const late = attendanceRecords.filter(r => r.status === 'late').length;
        const absent = attendanceRecords.filter(r => r.status === 'absent').length;
        const excused = attendanceRecords.filter(r => r.status === 'excused').length;
        const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

        return {
            total,
            present,
            late,
            absent,
            excused,
            attendanceRate
        };
    }, [attendanceRecords]);

    // Filtered Records based on status pill
    const filteredRecords = useMemo(() => {
        if (statusFilter === 'all') return attendanceRecords;
        return attendanceRecords.filter(r => r.status === statusFilter);
    }, [attendanceRecords, statusFilter]);

    if (!isOpen) return null;

    // Fee Status Badge Details
    let feeBadgeContent = null;
    if (feeStatus?.status === 'paused' || feeStatus?.isPaused || isStudentPaused(studentProfile?.status)) {
        feeBadgeContent = (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                    <CreditCard className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Fee Status: <strong className="text-slate-900 dark:text-white font-bold">Billing Paused</strong></span>
                </div>
                <div className="text-slate-500 dark:text-slate-400">
                    • Next Due: <strong className="text-slate-800 dark:text-slate-200 font-bold">Paused (No Active Due)</strong>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                    Billing Paused
                </span>
            </div>
        );
    } else if (studentProfile?.fees_basis === 'monthly') {
        const collectionDay = Number(studentProfile.fees_collection_date) || 1;
        const ordinal = getOrdinalSuffix(collectionDay);
        const dayLabel = `${collectionDay}${ordinal} of every month`;

        let statusBg = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
        let statusText = 'Paid / Good Standing';

        if (feeStatus?.hasPendingPayment) {
            statusBg = 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
            statusText = 'Pending Approval';
        } else if (feeStatus?.status === 'overdue') {
            statusBg = 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-800';
            statusText = 'Overdue';
        } else if (feeStatus?.status === 'due') {
            statusBg = 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
            statusText = 'Due Today';
        } else if (feeStatus?.status === 'upcoming') {
            statusBg = 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
            statusText = 'Upcoming Due';
        }

        const displayDueDate = feeStatus?.dueDate ? `${feeStatus.dueDate.getDate()} ${feeStatus.dueDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })}` : feeStatus?.formattedDueDate;

        feeBadgeContent = (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                    <CreditCard className="w-3.5 h-3.5 text-[#ecb613] shrink-0" />
                    <span>Fee Due Day: <strong className="text-slate-900 dark:text-white font-bold">{dayLabel}</strong></span>
                </div>
                {displayDueDate && (
                    <div className="text-slate-500 dark:text-slate-400">
                        • Next Due: <strong className="text-slate-800 dark:text-slate-200 font-bold">{displayDueDate}</strong>
                    </div>
                )}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusBg}`}>
                    {statusText}
                </span>
            </div>
        );
    } else if (studentProfile?.fees_basis === 'class') {
        const classesLeft = studentProfile.fees_classes_paid || 0;
        const isDepleted = classesLeft <= 0;
        feeBadgeContent = (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                    <CreditCard className="w-3.5 h-3.5 text-[#ecb613] shrink-0" />
                    <span>Structure: <strong className="text-slate-900 dark:text-white font-bold">Per-Class Basis</strong></span>
                </div>
                <div className="text-slate-500 dark:text-slate-400">
                    • Classes Available: <strong className="text-slate-800 dark:text-slate-200 font-bold">{classesLeft}</strong>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    isDepleted 
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-800' 
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                }`}>
                    {isDepleted ? 'Renewal Due' : 'Active'}
                </span>
            </div>
        );
    }

    const modalContent = (
        <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm overflow-hidden"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl flex flex-col animate-in zoom-in-95 duration-200 text-left max-h-[92vh] overflow-hidden">
                
                {/* ── 1. MODAL HEADER: Student Profile & Fee Status ── */}
                <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                                {studentProfile?.profile_pic_url ? (
                                    <img src={studentProfile.profile_pic_url} alt={studentProfile.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-[#ecb613] text-xl font-black">{studentProfile?.name?.charAt(0) || 'S'}</span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                                        {studentProfile?.name || 'Student Attendance History'}
                                    </h3>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#ecb613]/15 text-[#92400e] dark:text-[#ecb613] border border-[#ecb613]/30">
                                        Student History
                                    </span>
                                    {isStudentPaused(studentProfile?.status) && (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                            Paused Learning
                                        </span>
                                    )}
                                </div>

                                {/* Permanent Classroom & Timing */}
                                <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                                    {permanentClassrooms.length > 0 ? (
                                        permanentClassrooms.map((c, idx) => (
                                            <span key={c.id || idx} className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                                                <School className="w-3.5 h-3.5 text-[#ecb613]" />
                                                {c.name}
                                                {c.scheduleText && (
                                                    <span className="text-slate-400 dark:text-slate-500 font-normal">
                                                        ({c.scheduleText})
                                                    </span>
                                                )}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-slate-400 italic">No permanent classroom assigned</span>
                                    )}
                                </div>

                                {/* Fee Due Information */}
                                <div className="mt-2">
                                    {feeBadgeContent}
                                </div>
                            </div>
                        </div>

                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                            title="Close (Esc)"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Paused Learning Banner */}
                    {isStudentPaused(studentProfile?.status) && (
                        <div className="mt-3 p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <div>
                                    <strong>Learning is currently paused for this student.</strong> Classroom attendance and active fee billing cycles are suspended. Historical attendance and payment records are preserved below.
                                </div>
                                {feeStatus?.hasPrePauseDebt && (
                                    <div className="text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
                                        ⚠️ Outstanding Pre-Pause Balance: An unpaid fee cycle from before learning was paused remains pending.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── MODAL BODY: Scrollable content ── */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
                    
                    {/* ── 2. DATE RANGE CONTROLS ── */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-[#ecb613] shrink-0" />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                Reporting Period
                            </span>
                        </div>

                        {/* Quick Presets & Date Inputs */}
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold shrink-0">
                                <button
                                    type="button"
                                    onClick={setThisMonth}
                                    className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                    This Month
                                </button>
                                <button
                                    type="button"
                                    onClick={setLastMonth}
                                    className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                    Last Month
                                </button>
                                <button
                                    type="button"
                                    onClick={setLast3Months}
                                    className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                    Last 3 Mos
                                </button>
                            </div>

                            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">From</span>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none border-none p-0 cursor-pointer"
                                />
                                <span className="text-slate-300 dark:text-slate-600 font-bold text-xs">→</span>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">To</span>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none border-none p-0 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── 3. ATTENDANCE SUMMARY METRICS ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sessions</p>
                            <h5 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{metrics.total}</h5>
                        </div>
                        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40">
                            <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Present</p>
                            <h5 className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{metrics.present}</h5>
                        </div>
                        <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                            <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Late</p>
                            <h5 className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">{metrics.late}</h5>
                        </div>
                        <div className="bg-rose-50/50 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-200/60 dark:border-rose-900/40">
                            <p className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Absent</p>
                            <h5 className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">{metrics.absent}</h5>
                        </div>
                        <div className="bg-slate-100/60 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Excused</p>
                            <h5 className="text-lg font-black text-slate-700 dark:text-slate-300 mt-0.5">{metrics.excused}</h5>
                        </div>
                        <div className="bg-yellow-50/50 dark:bg-yellow-950/20 p-3 rounded-xl border border-yellow-200/60 dark:border-yellow-900/40">
                            <p className="text-[9px] font-black text-[#92400e] dark:text-[#ecb613] uppercase tracking-widest">Att. Rate</p>
                            <h5 className="text-lg font-black text-[#92400e] dark:text-[#ecb613] mt-0.5">{metrics.attendanceRate}%</h5>
                        </div>
                        <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-200/60 dark:border-blue-900/40 col-span-2 sm:col-span-2 lg:col-span-1">
                            <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Makeups</p>
                            <h5 className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
                                {completedMakeupsCount} <span className="text-xs font-normal text-slate-400">/ {completedMakeupsCount + pendingMakeupsCount}</span>
                            </h5>
                        </div>
                    </div>

                    {/* ── 4. STATUS FILTER TABS ── */}
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 w-fit flex-wrap">
                        {([
                            { key: 'all' as const, label: 'All', count: metrics.total },
                            { key: 'present' as const, label: 'Present', count: metrics.present },
                            { key: 'late' as const, label: 'Late', count: metrics.late },
                            { key: 'absent' as const, label: 'Absent', count: metrics.absent },
                            { key: 'excused' as const, label: 'Excused', count: metrics.excused },
                        ]).map((tab) => {
                            const isActive = statusFilter === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setStatusFilter(tab.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        isActive 
                                            ? 'bg-[#ecb613] text-slate-900 shadow-sm' 
                                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                    }`}
                                >
                                    <span>{tab.label}</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                                        isActive ? 'bg-black/20 text-slate-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* ── 5. DETAILED ATTENDANCE LOG TABLE ── */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <Loader2 className="w-7 h-7 animate-spin text-[#ecb613] mb-2" />
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading student history...</p>
                            </div>
                        ) : filteredRecords.length > 0 ? (
                            <div>
                                {/* Mobile Card List */}
                                <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {filteredRecords.map((record) => (
                                        <div key={record.id} className="p-3.5 space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                    {formatLocalDateStr(record.date, true)}
                                                </span>
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                    record.status === 'present'
                                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30'
                                                        : record.status === 'late'
                                                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30'
                                                        : record.status === 'absent'
                                                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30'
                                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                }`}>
                                                    {record.status}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-2 text-xs">
                                                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                                                    {record.classroom_name}
                                                </span>
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shrink-0 ${
                                                    record.sessionType === 'guest_makeup'
                                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30'
                                                        : record.sessionType === 'special'
                                                        ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/30'
                                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                                                }`}>
                                                    {record.sessionType === 'guest_makeup' ? 'Guest Makeup' : record.sessionType === 'special' ? 'Special Session' : 'Regular'}
                                                </span>
                                            </div>

                                            {/* Makeup Relationship Details */}
                                            {record.makeupDetails?.isMakeupAttended && record.makeupDetails.makeupForDate && (
                                                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                                                    ↳ Makeup for missed class on {formatLocalDateStr(record.makeupDetails.makeupForDate, true)}
                                                </p>
                                            )}
                                            {record.makeupDetails?.missedResolvedByDate && (
                                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                                    <Check className="w-3 h-3" />
                                                    Makeup attended on {formatLocalDateStr(record.makeupDetails.missedResolvedByDate, true)} in {record.makeupDetails.missedResolvedInClass}
                                                </p>
                                            )}
                                            {record.makeupDetails?.missedScheduledDate && (
                                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    Makeup scheduled on {formatLocalDateStr(record.makeupDetails.missedScheduledDate, true)} in {record.makeupDetails.missedScheduledClass}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table */}
                                <div className="hidden sm:block overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[650px]">
                                        <thead>
                                            <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                                                <th className="px-4 py-3">Date</th>
                                                <th className="px-4 py-3">Classroom / Session</th>
                                                <th className="px-4 py-3">Type</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3">Makeup & Session Details</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                                            {filteredRecords.map((record) => (
                                                <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                                        {formatLocalDateStr(record.date, true)}
                                                    </td>
                                                    <td className="px-4 py-3 font-extrabold text-slate-900 dark:text-white">
                                                        {record.classroom_name}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                            record.sessionType === 'guest_makeup'
                                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                                                : record.sessionType === 'special'
                                                                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                                                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                                                        }`}>
                                                            {record.sessionType === 'guest_makeup' 
                                                                ? 'Guest Makeup' 
                                                                : record.sessionType === 'special' 
                                                                ? 'Special Session' 
                                                                : 'Regular'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                            record.status === 'present'
                                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                                : record.status === 'late'
                                                                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                                                                : record.status === 'absent'
                                                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                        }`}>
                                                            {record.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                        {record.makeupDetails?.isMakeupAttended && record.makeupDetails.makeupForDate ? (
                                                            <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                                                                <ArrowRight className="w-3 h-3" />
                                                                Makeup for missed {formatLocalDateStr(record.makeupDetails.makeupForDate, true)}
                                                            </span>
                                                        ) : record.makeupDetails?.missedResolvedByDate ? (
                                                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                                                <Check className="w-3 h-3" />
                                                                Makeup attended on {formatLocalDateStr(record.makeupDetails.missedResolvedByDate, true)} ({record.makeupDetails.missedResolvedInClass})
                                                            </span>
                                                        ) : record.makeupDetails?.missedScheduledDate ? (
                                                            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                Makeup scheduled for {formatLocalDateStr(record.makeupDetails.missedScheduledDate, true)} ({record.makeupDetails.missedScheduledClass})
                                                            </span>
                                                        ) : (record.status === 'absent' || record.status === 'excused') ? (
                                                            <span className="text-slate-400 italic">No makeup scheduled</span>
                                                        ) : (
                                                            <span className="text-slate-400">Regular attendance</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="py-14 text-center">
                                <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                <h6 className="font-extrabold text-slate-400">No attendance logs found</h6>
                                <p className="text-xs text-slate-400 mt-1">
                                    {statusFilter !== 'all' 
                                        ? `There are no "${statusFilter}" records for this student in the selected date range.` 
                                        : 'There are no attendance records for this student in the selected range.'}
                                </p>
                            </div>
                        )}
                    </div>

                </div>

                {/* ── MODAL FOOTER ── */}
                <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 flex justify-between items-center shrink-0">
                    <div className="text-[11px] text-slate-400 font-medium">
                        Showing {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} from {formatLocalDateStr(fromDate, true)} to {formatLocalDateStr(toDate, true)}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
};
