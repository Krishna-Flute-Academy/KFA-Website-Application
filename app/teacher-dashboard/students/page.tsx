'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { Loader2 } from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';
import Link from 'next/link';
import { sortClassroomsByDayAndTime } from '../../../src/lib/classroomSort';

interface StudentData {
    id: string;
    user_id: string;
    name: string;
    email?: string;
    role?: string;
    profile_pic_url?: string;
    student_id_formatted: string;
    batch: string;
    attendance_pct: number;
    status: string;
    pacing_status?: 'Consistent' | 'Improving' | 'At Risk';
    is_online?: boolean;
    created_at?: string;
    teacher_id?: string | null;
    teacher_name?: string;
    phone?: string;
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
    teacher_id?: string | null;
}

export default function StudentDirectory() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; phone?: string | null; role?: string; profile_pic_url?: string | null } | null>(null);
    const [students, setStudents] = useState<StudentData[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [stats, setStats] = useState({
        avgAttendance: 0,
        submissionRate: 76, // Mocked for now
    });
    const [filterMode, setFilterMode] = useState<'all' | 'recent' | 'unassigned'>('all');
    const [unassignedStudents, setUnassignedStudents] = useState<StudentData[]>([]);
    const [claimingId, setClaimingId] = useState<string | null>(null);
    const [showClaimModal, setShowClaimModal] = useState<StudentData | null>(null);
    const [claimBatchId, setClaimBatchId] = useState('');
    const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
    const [claimTeacherId, setClaimTeacherId] = useState('');
    const [selectedBatch, setSelectedBatch] = useState<string>('All Batches');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived' | 'inactive'>('active');
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

    // Pending signup requests (users who signed up but not yet assigned a role)
    const [pendingUsers, setPendingUsers] = useState<{ id: string; name: string; email: string; phone?: string; created_at: string }[]>([]);

    interface DeletedStudentItem {
        id: string;
        name: string;
        deletedAt: string;
        student: any;
    }
    const [recycleBin, setRecycleBin] = useState<DeletedStudentItem[]>([]);
    const [showRecycleBin, setShowRecycleBin] = useState(false);

    useEffect(() => {
        const savedBin = localStorage.getItem('students_recycle_bin');
        if (savedBin) {
            try {
                setRecycleBin(JSON.parse(savedBin));
            } catch (e) {
                console.error(e);
            }
        }
    }, []);

    const saveRecycleBin = (bin: DeletedStudentItem[]) => {
        setRecycleBin(bin);
        localStorage.setItem('students_recycle_bin', JSON.stringify(bin));
    };

    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [filterMode, selectedBatch, statusFilter, searchQuery]);

    // Clear selection when page changes or filters change
    useEffect(() => {
        setSelectedIds(new Set());
    }, [currentPage, filterMode, selectedBatch, statusFilter, searchQuery]);

    const reEvaluateOnlineStatus = async () => {
        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data: activeSessions } = await supabaseAuth
                .from('user_sessions')
                .select('user_id')
                .is('logout_at', null)
                .gt('last_activity_at', fiveMinutesAgo);
            
            const onlineUserIds = new Set<string>(activeSessions?.map(sess => sess.user_id) || []);
            
            setStudents(prev => prev.map(s => ({
                ...s,
                is_online: onlineUserIds.has(s.id)
            })));
            
            setUnassignedStudents(prev => prev.map(s => ({
                ...s,
                is_online: onlineUserIds.has(s.id)
            })));
        } catch (e) {
            console.error('Error re-evaluating online status:', e);
        }
    };

    // SWR Cache Saver for Students Directory
    useEffect(() => {
        if (students.length === 0) return;
        const timer = setTimeout(() => {
            try {
                const cacheData = { students, classrooms, teachers, stats, unassignedStudents, teacherProfile };
                localStorage.setItem('kfa_students_cache', JSON.stringify(cacheData));
            } catch (e) { console.error('Students cache save error:', e); }
        }, 300);
        return () => clearTimeout(timer);
    }, [students, classrooms, teachers, stats, unassignedStudents, teacherProfile]);

    useEffect(() => {
        let hasCachedData = false;
        try {
            const cached = localStorage.getItem('kfa_students_cache');
            if (cached) {
                const data = JSON.parse(cached);
                if (data.students) setStudents(data.students);
                if (data.classrooms) setClassrooms(data.classrooms);
                if (data.teachers) setTeachers(data.teachers);
                if (data.stats) setStats(data.stats);
                if (data.unassignedStudents) setUnassignedStudents(data.unassignedStudents);
                if (data.teacherProfile) setTeacherProfile(data.teacherProfile);
                setLoading(false);
                hasCachedData = true;
            }
        } catch (e) { console.error('Students cache load error:', e); }

        const checkAuthAndFetchData = async () => {
            if (!hasCachedData) setLoading(true);
            try {
                // 1. Check Session
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                const userId = session.user.id;

                // 2. Verify Teacher/Admin Role & Get Profile
                const { data: profile, error: profileError } = await supabaseAuth
                    .from('users')
                    .select('name, email, phone, role, profile_pic_url')
                    .eq('id', userId)
                    .single();

                if (profileError || (profile?.role !== 'teacher' && profile?.role !== 'admin')) {
                    router.push('/');
                    return;
                }

                setTeacherProfile({ id: userId, name: profile.name, email: profile.email, phone: profile.phone, role: profile.role, profile_pic_url: profile.profile_pic_url });
                const isAdminUser = profile.role === 'admin';

                // Parallelize all secondary fetches (rooms, teachers, lessons, sessions, attendance, progress, assignments, students)
                const fiveMinutesAgoForQuery = new Date(Date.now() - 5 * 60 * 1000).toISOString();

                const roomsReq = isAdminUser
                    ? supabaseAuth.from('classrooms').select('id, name, teacher_id')
                    : supabaseAuth.from('classrooms').select('id, name, teacher_id').eq('teacher_id', userId);

                const teachersReq = supabaseAuth.from('users').select('id, name').in('role', ['teacher', 'admin']);
                const lessonsReq = supabaseAuth.from('course_lessons').select('id');
                const sessionsReq = supabaseAuth.from('user_sessions').select('user_id').is('logout_at', null).gt('last_activity_at', fiveMinutesAgoForQuery);
                const attendanceReq = supabaseAuth.from('attendance').select('student_id, status');
                const progressReq = supabaseAuth.from('student_topic_progress').select('student_id').eq('status', 'completed');
                const assignmentsReq = supabaseAuth.from('assignment_students').select('student_id, status, score');

                const studentsBaseReq = supabaseAuth
                    .from('users')
                    .select(`
                        id,
                        name,
                        email,
                        role,
                        status,
                        profile_pic_url,
                        created_at,
                        teacher_id,
                        phone,
                        classroom_students(
                            classrooms(name)
                        )
                    `)
                    .in('role', ['student', 'mentor']);

                const studentsReq = isAdminUser
                    ? studentsBaseReq
                    : studentsBaseReq.eq('teacher_id', userId);

                const [
                    { data: rooms },
                    { data: teachersData },
                    { data: lessons },
                    { data: activeSessions },
                    { data: allAttendance },
                    { data: allProgress },
                    { data: allAssignments },
                    { data: studentsData, error: studentsError }
                ] = await Promise.all([
                    roomsReq,
                    teachersReq,
                    lessonsReq,
                    sessionsReq,
                    attendanceReq,
                    progressReq,
                    assignmentsReq,
                    studentsReq
                ]);

                if (rooms) setClassrooms(rooms);

                const teacherMap = new Map<string, string>();
                if (teachersData) {
                    setTeachers(teachersData);
                    teachersData.forEach(t => teacherMap.set(t.id, t.name));
                }

                const totalLessonsCount = lessons?.length || 0;
                const onlineUserIds = new Set<string>(activeSessions?.map(sess => sess.user_id) || []);

                const attendanceMap = new Map<string, string[]>();
                allAttendance?.forEach(a => {
                    if (!attendanceMap.has(a.student_id)) {
                        attendanceMap.set(a.student_id, []);
                    }
                    attendanceMap.get(a.student_id)!.push(a.status);
                });

                const progressCountMap = new Map<string, number>();
                allProgress?.forEach(p => {
                    progressCountMap.set(p.student_id, (progressCountMap.get(p.student_id) || 0) + 1);
                });

                const assignmentsMap = new Map<string, { status: string; score: number | null }[]>();
                allAssignments?.forEach(a => {
                    if (!assignmentsMap.has(a.student_id)) {
                        assignmentsMap.set(a.student_id, []);
                    }
                    assignmentsMap.get(a.student_id)!.push({ status: a.status, score: a.score ? Number(a.score) : null });
                });

                if (studentsError) {
                    console.error('Supabase error fetching students:', {
                        message: studentsError.message,
                        code: studentsError.code,
                        details: studentsError.details,
                        hint: studentsError.hint,
                        raw: studentsError
                    });
                }

                if (studentsData) {
                    const formatted: StudentData[] = studentsData.map((s: any) => {
                        const studentAttendance = attendanceMap.get(s.id) || [];
                        const completedCount = progressCountMap.get(s.id) || 0;
                        const studentAssignments = assignmentsMap.get(s.id) || [];

                        // 1. Calculate Attendance Percentage
                        let attendancePct = 100;
                        const eligibleAttendance = studentAttendance.filter(status => status !== 'excused');
                        if (eligibleAttendance.length > 0) {
                            const presentCount = eligibleAttendance.filter(status => status === 'present' || status === 'late').length;
                            attendancePct = Math.round((presentCount / eligibleAttendance.length) * 100);
                        }

                        // 2. Calculate Progress Percentage
                        const progressPct = totalLessonsCount > 0 ? Math.round((completedCount / totalLessonsCount) * 100) : 0;

                        // 3. Calculate Submissions and Avg Score
                        let submissionPct = 100;
                        let avgScore = 10;
                        if (studentAssignments.length > 0) {
                            const submittedCount = studentAssignments.filter(a => a.status === 'submitted' || a.status === 'reviewed' || a.status === 'approved').length;
                            submissionPct = Math.round((submittedCount / studentAssignments.length) * 105) % 100; // Keep it clean
                            
                            const graded = studentAssignments.filter(a => a.score !== null);
                            if (graded.length > 0) {
                                const sum = graded.reduce((acc, curr) => acc + curr.score!, 0);
                                avgScore = sum / graded.length;
                            }
                        }

                        // 4. Calculate Pacing Status
                        const calcValues = [progressPct];
                        if (studentAssignments.length > 0) {
                            calcValues.push(submissionPct);
                            calcValues.push(avgScore * 10);
                        }
                        if (studentAttendance.length > 0) {
                            calcValues.push(attendancePct);
                        }

                        const cumulativeAverage = Math.round(calcValues.reduce((a, b) => a + b, 0) / calcValues.length);

                        let calculatedStatus: 'Consistent' | 'Improving' | 'At Risk' = 'Consistent';
                        if (studentAttendance.length > 0 || studentAssignments.length > 0) {
                            if (cumulativeAverage >= 80) calculatedStatus = 'Consistent';
                            else if (cumulativeAverage >= 65) calculatedStatus = 'Improving';
                            else calculatedStatus = 'At Risk';
                        }

                        return {
                            id: s.id,
                            user_id: s.id,
                            name: s.name,
                            email: s.email,
                            role: s.role,
                            student_id_formatted: `KFA-2024-${s.id.slice(0, 3).toUpperCase()}`,
                            batch: (s.status === 'archived' || s.status === 'inactive') ? (s.classroom_students?.[0]?.classrooms?.name || 'KFA Learning Circle') : (s.classroom_students?.[0]?.classrooms?.name || 'Unassigned'),
                            attendance_pct: attendancePct,
                            profile_pic_url: s.profile_pic_url,
                            status: (s.status === 'archived' || s.status === 'inactive') ? 'Archived' : 'Active',
                            pacing_status: calculatedStatus,
                            is_online: onlineUserIds.has(s.id),
                            created_at: s.created_at,
                            teacher_id: s.teacher_id,
                            teacher_name: s.teacher_id ? (teacherMap.get(s.teacher_id) || 'Unknown Teacher') : 'Unassigned',
                            phone: s.phone || 'No Phone'
                        };
                    });

                    setStudents(formatted);

                    if (formatted.length > 0) {
                        const avg = Math.round(formatted.reduce((acc, curr) => acc + curr.attendance_pct, 0) / formatted.length);
                        
                        let studentsWithAssignments = 0;
                        let sumSubmissionPct = 0;
                        
                        formatted.forEach(f => {
                            const studentAssignments = assignmentsMap.get(f.id) || [];
                            if (studentAssignments.length > 0) {
                                const submittedCount = studentAssignments.filter(a => a.status === 'submitted' || a.status === 'reviewed' || a.status === 'approved').length;
                                const pct = Math.round((submittedCount / studentAssignments.length) * 100);
                                sumSubmissionPct += pct;
                                studentsWithAssignments++;
                            }
                        });
                        
                        const avgSubmissions = studentsWithAssignments > 0 
                            ? Math.round(sumSubmissionPct / studentsWithAssignments) 
                            : 76;
                            
                        setStats({
                            avgAttendance: avg,
                            submissionRate: avgSubmissions
                        });
                    }
                }

                // 5. Fetch Unassigned Students (Admins and Teachers)
                const { data: unassignedData, error: unassignedError } = await supabaseAuth
                    .from('users')
                    .select(`
                        id,
                        name,
                        status,
                        profile_pic_url,
                        created_at,
                        teacher_id,
                        phone
                    `)
                    .eq('role', 'student')
                    .is('teacher_id', null);

                if (unassignedError) {
                    console.error('Supabase error fetching unassigned students:', {
                        message: unassignedError.message,
                        code: unassignedError.code,
                        details: unassignedError.details,
                        hint: unassignedError.hint,
                        raw: unassignedError
                    });
                }

                if (unassignedData) {
                    const formattedUnassigned = unassignedData.map((s: any) => {
                        const studentAttendance = attendanceMap.get(s.id) || [];
                        const completedCount = progressCountMap.get(s.id) || 0;
                        const studentAssignments = assignmentsMap.get(s.id) || [];

                        let attendancePct = 100;
                        const eligibleAttendance = studentAttendance.filter(status => status !== 'excused');
                        if (eligibleAttendance.length > 0) {
                            const presentCount = eligibleAttendance.filter(status => status === 'present' || status === 'late').length;
                            attendancePct = Math.round((presentCount / eligibleAttendance.length) * 100);
                        }

                        const progressPct = totalLessonsCount > 0 ? Math.round((completedCount / totalLessonsCount) * 100) : 0;

                        let submissionPct = 100;
                        let avgScore = 10;
                        if (studentAssignments.length > 0) {
                            const submittedCount = studentAssignments.filter(a => a.status === 'submitted' || a.status === 'reviewed' || a.status === 'approved').length;
                            submissionPct = Math.round((submittedCount / studentAssignments.length) * 100);
                            
                            const graded = studentAssignments.filter(a => a.score !== null);
                            if (graded.length > 0) {
                                const sum = graded.reduce((acc, curr) => acc + curr.score!, 0);
                                avgScore = sum / graded.length;
                            }
                        }

                        const calcValues = [progressPct];
                        if (studentAssignments.length > 0) {
                            calcValues.push(submissionPct);
                            calcValues.push(avgScore * 10);
                        }
                        if (studentAttendance.length > 0) {
                            calcValues.push(attendancePct);
                        }

                        const cumulativeAverage = Math.round(calcValues.reduce((a, b) => a + b, 0) / calcValues.length);

                        let calculatedStatus: 'Consistent' | 'Improving' | 'At Risk' = 'Consistent';
                        if (studentAttendance.length > 0 || studentAssignments.length > 0) {
                            if (cumulativeAverage >= 80) calculatedStatus = 'Consistent';
                            else if (cumulativeAverage >= 65) calculatedStatus = 'Improving';
                            else calculatedStatus = 'At Risk';
                        }

                        return {
                            id: s.id,
                            user_id: s.id,
                            name: s.name,
                            student_id_formatted: `KFA-2024-${s.id.slice(0, 3).toUpperCase()}`,
                            batch: 'Unassigned',
                            attendance_pct: attendancePct,
                            profile_pic_url: s.profile_pic_url,
                            status: s.status === 'active' ? 'Active' : 'Inactive',
                            pacing_status: calculatedStatus,
                            is_online: onlineUserIds.has(s.id),
                            created_at: s.created_at,
                            teacher_id: s.teacher_id,
                            teacher_name: 'Unassigned',
                            phone: s.phone || 'No Phone'
                        };
                    });
                    setUnassignedStudents(formattedUnassigned);
                }

                // 6. Fetch pending signup requests (role = 'pending')
                const { data: pendingData } = await supabaseAuth
                    .from('users')
                    .select('id, name, email, phone, created_at')
                    .eq('role', 'pending')
                    .order('created_at', { ascending: false });

                if (isMounted && pendingData) setPendingUsers(pendingData);

            } catch (err) {
                console.error('Error fetching students:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        let isMounted = true;
        let unassignedChannel: any = null;
        let pendingChannel: any = null;
        let sessionsChannel: any = null;

        checkAuthAndFetchData();

        // Real-time subscription to listen for new student signups instantly!
        unassignedChannel = supabaseAuth
            .channel('realtime-unassigned-students')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'users' },
                (payload) => {
                    if (!isMounted) return;
                    const newStudent = payload.new;
                    if (newStudent && newStudent.role === 'student' && !newStudent.teacher_id) {
                        setUnassignedStudents(prev => [{
                            id: newStudent.id,
                            user_id: newStudent.id,
                            name: newStudent.name,
                            student_id_formatted: `KFA-2024-${newStudent.id.slice(0, 3).toUpperCase()}`,
                            batch: 'Unassigned',
                            attendance_pct: 0,
                            profile_pic_url: newStudent.profile_pic_url,
                            status: newStudent.status === 'active' ? 'Active' : 'Inactive',
                            created_at: newStudent.created_at || new Date().toISOString(),
                            phone: newStudent.phone || 'No Phone'
                        }, ...prev]);
                    }
                }
            )
            .subscribe();

        // Real-time: new pending signup requests
        pendingChannel = supabaseAuth
            .channel('realtime-pending-users')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'users' },
                (payload) => {
                    if (!isMounted) return;
                    const u = payload.new as any;
                    if (payload.eventType === 'INSERT' && u?.role === 'pending') {
                        setPendingUsers(prev => [{ id: u.id, name: u.name, email: u.email, phone: u.phone, created_at: u.created_at || new Date().toISOString() }, ...prev]);
                    } else if (payload.eventType === 'UPDATE' && u?.role !== 'pending') {
                        // Remove from list once admin assigns a role
                        setPendingUsers(prev => prev.filter(p => p.id !== u.id));
                    }
                }
            )
            .subscribe();

        // Subscribe to user session changes (online/offline updates)
        sessionsChannel = supabaseAuth
            .channel('realtime-sessions-students-directory')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_sessions' },
                () => {
                    if (isMounted) {
                        reEvaluateOnlineStatus();
                    }
                }
            )
            .subscribe();

        // Refresh online statuses in real-time every 30 seconds
        const onlineCheckerTimer = setInterval(() => {
            if (isMounted) {
                reEvaluateOnlineStatus();
            }
        }, 30000);

        return () => {
            isMounted = false;
            if (unassignedChannel) {
                supabaseAuth.removeChannel(unassignedChannel);
            }
            if (pendingChannel) {
                supabaseAuth.removeChannel(pendingChannel);
            }
            if (sessionsChannel) {
                supabaseAuth.removeChannel(sessionsChannel);
            }
            clearInterval(onlineCheckerTimer);
        };
    }, [router]);

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    const claimStudent = async () => {
        if (!teacherProfile || !showClaimModal || !claimBatchId) {
            alert('Please select a batch.');
            return;
        }
        
        setClaimingId(showClaimModal.id);
        try {
            const isAdmin = teacherProfile.role === 'admin';
            const assignedTeacherId = isAdmin ? claimTeacherId : teacherProfile.id;

            if (isAdmin && !assignedTeacherId) {
                alert('Please select a teacher.');
                setClaimingId(null);
                return;
            }

            // 1. Update teacher_id
            const { error: userError } = await supabaseAuth
                .from('users')
                .update({ teacher_id: assignedTeacherId })
                .eq('id', showClaimModal.id);

            if (userError) throw userError;

            // 2. Add to classroom_students
            const { error: classError } = await supabaseAuth
                .from('classroom_students')
                .insert([{
                    classroom_id: claimBatchId,
                    student_id: showClaimModal.id,
                    joined_at: new Date().toISOString(),
                }]);
                
            if (classError) throw classError;

            const selectedClassroom = classrooms.find(c => c.id === claimBatchId);
            const batchName = selectedClassroom?.name || 'Assigned';

            // Find the claimed student from the unassigned list
            const claimed = unassignedStudents.find(s => s.id === showClaimModal.id);
            if (claimed) {
                const assignedTeacherName = teachers.find(t => t.id === assignedTeacherId)?.name || 'Unknown Teacher';
                // Add to assigned students and remove from unassigned students
                setStudents(prev => [...prev, { 
                    ...claimed, 
                    batch: batchName,
                    teacher_id: assignedTeacherId,
                    teacher_name: assignedTeacherName
                }]);
                setUnassignedStudents(prev => prev.filter(s => s.id !== showClaimModal.id));
            }
            
            setShowClaimModal(null);
            setClaimBatchId('');
            setClaimTeacherId('');
        } catch (err) {
            console.error('Error claiming student:', err);
            alert('Failed to assign student. Please try again.');
        } finally {
            setClaimingId(null);
        }
    };

    const [showReactivateModal, setShowReactivateModal] = useState<StudentData | null>(null);
    const [reactivateBatchId, setReactivateBatchId] = useState('');
    const [isReactivating, setIsReactivating] = useState(false);

    const toggleStudentStatus = async (studentId: string, currentStatus: string) => {
        const isArchiving = currentStatus === 'Active';
        const student = students.find(s => s.id === studentId);

        if (!isArchiving) {
            if (student) {
                const defaultRoom = classrooms.find(c => !c.name.toLowerCase().includes('learning circle'))?.id || classrooms[0]?.id || '';
                setReactivateBatchId(defaultRoom);
                setShowReactivateModal(student);
            }
            return;
        }

        if (!confirm(`Archive ${student?.name || 'this student'}? They will be automatically assigned to KFA Learning Circle.`)) {
            return;
        }

        // Optimistic update
        setStudents(prev => prev.map(s => {
            if (s.id === studentId) {
                return {
                    ...s,
                    status: 'Archived',
                    batch: 'KFA Learning Circle'
                };
            }
            return s;
        }));

        try {
            const { error: userError } = await supabaseAuth
                .from('users')
                .update({ status: 'inactive' })
                .eq('id', studentId);
                
            if (userError) throw userError;

            let circleRoomId: string | null = null;
            const { data: circleRoom } = await supabaseAuth
                .from('classrooms')
                .select('id')
                .ilike('name', '%Learning Circle%')
                .maybeSingle();

            if (circleRoom) {
                circleRoomId = circleRoom.id;
            } else {
                const { data: newRoom } = await supabaseAuth
                    .from('classrooms')
                    .insert([{
                        name: 'KFA Learning Circle',
                        type: 'learning_circle',
                        description: 'Community & Self-Paced Learning Circle for KFA Alumni & Inactive Students',
                        status: 'active'
                    }])
                    .select('id')
                    .single();

                if (newRoom) circleRoomId = newRoom.id;
            }

            if (circleRoomId) {
                await supabaseAuth
                    .from('classroom_students')
                    .delete()
                    .eq('student_id', studentId);

                await supabaseAuth
                    .from('classroom_students')
                    .insert([{
                        classroom_id: circleRoomId,
                        student_id: studentId,
                        joined_at: new Date().toISOString()
                    }]);
            }
        } catch (err: any) {
            console.error('Error updating status:', err);
            alert(`Error updating status: ${err.message || err.details || String(err)}`);
            // Revert on error
            setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: currentStatus } : s));
        }
    };

    const confirmReactivateStudent = async () => {
        if (!showReactivateModal || !reactivateBatchId) return;

        setIsReactivating(true);
        try {
            const targetStudentId = showReactivateModal.id;

            const { error: userErr } = await supabaseAuth
                .from('users')
                .update({ status: 'active' })
                .eq('id', targetStudentId);

            if (userErr) throw userErr;

            await supabaseAuth
                .from('classroom_students')
                .delete()
                .eq('student_id', targetStudentId);

            const { error: roomErr } = await supabaseAuth
                .from('classroom_students')
                .insert([{
                    classroom_id: reactivateBatchId,
                    student_id: targetStudentId,
                    joined_at: new Date().toISOString()
                }]);

            if (roomErr) console.error('Error assigning classroom during reactivation:', roomErr);

            const roomName = classrooms.find(c => c.id === reactivateBatchId)?.name || 'Active Batch';

            setStudents(prev => prev.map(s => s.id === targetStudentId ? { ...s, status: 'Active', batch: roomName } : s));

            const studentName = showReactivateModal.name;
            setShowReactivateModal(null);
            setReactivateBatchId('');
            alert(`Student ${studentName} reactivated and allocated to ${roomName}!`);
        } catch (err: any) {
            console.error('Error reactivating student:', err);
            alert(`Error reactivating student: ${err.message || err.details || String(err)}`);
        } finally {
            setIsReactivating(false);
        }
    };

    // ─── Single Delete ────────────────────────────────────────────────────────
    const confirmDelete = async () => {
        if (!studentToDelete) return;

        setIsDeleting(true);
        try {
            // 1. Fetch full details for the recycle bin
            const { data: fullStudent, error: fetchErr } = await supabaseAuth
                .from('users')
                .select('*')
                .eq('id', studentToDelete.id)
                .single();

            if (fetchErr) {
                console.error("Error fetching student details for recycle bin:", fetchErr);
                alert("Failed to archive student in Recycle Bin. Aborting deletion.");
                setIsDeleting(false);
                return;
            }

            // 2. Delete from database
            const { error } = await supabaseAuth
                .from('users')
                .delete()
                .eq('id', studentToDelete.id);

            if (error) {
                console.error("Supabase deletion error:", error);
                alert("Failed to delete student. Please try again.");
                return;
            }

            // 3. Put into Recycle Bin local storage
            const newBinItem: DeletedStudentItem = {
                id: studentToDelete.id,
                name: studentToDelete.name,
                deletedAt: new Date().toISOString(),
                student: fullStudent
            };
            saveRecycleBin([newBinItem, ...recycleBin]);

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

            // 1. Fetch full details for the recycle bin
            const { data: fullStudents, error: fetchErr } = await supabaseAuth
                .from('users')
                .select('*')
                .in('id', ids);

            if (fetchErr || !fullStudents || fullStudents.length === 0) {
                console.error("Error fetching students details for recycle bin:", fetchErr);
                alert("Failed to archive students in Recycle Bin. Aborting deletion.");
                setIsBulkDeleting(false);
                return;
            }

            // 2. Delete from database
            const { error } = await supabaseAuth
                .from('users')
                .delete()
                .in('id', ids);

            if (error) {
                console.error("Bulk deletion error:", error);
                alert("Failed to delete selected students. Please try again.");
                return;
            }

            // 3. Put into Recycle Bin local storage
            const newBinItems: DeletedStudentItem[] = fullStudents.map(student => ({
                id: student.id,
                name: student.name,
                deletedAt: new Date().toISOString(),
                student: student
            }));
            saveRecycleBin([...newBinItems, ...recycleBin]);

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

    const handleRestoreStudent = async (item: DeletedStudentItem) => {
        try {
            const { error } = await supabaseAuth
                .from('users')
                .insert([item.student]);

            if (error) {
                console.error("Supabase restore error:", error);
                alert(`Failed to restore student: ${error.message}`);
                return;
            }

            const updatedBin = recycleBin.filter(b => b.id !== item.id);
            saveRecycleBin(updatedBin);

            const restoredData: StudentData = {
                id: item.student.id,
                user_id: item.student.id,
                name: item.student.name,
                student_id_formatted: 'KFA-' + item.student.student_serial_id.toString().padStart(4, '0'),
                batch: 'Unassigned',
                attendance_pct: 100,
                pacing_status: 'Consistent',
                is_online: false,
                profile_pic_url: item.student.profile_pic_url || '',
                teacher_name: '',
                phone: item.student.phone || '',
                status: item.student.status || 'active'
            };
            setStudents(prev => [restoredData, ...prev]);

            alert(`Student "${item.name}" restored successfully!`);
        } catch (err: any) {
            console.error('Error restoring student:', err);
            alert("An unexpected error occurred while restoring the student.");
        }
    };

    const handlePermanentDeleteStudent = (itemId: string) => {
        if (!window.confirm("Are you sure you want to permanently delete this student from the Recycle Bin? This action is permanent and cannot be undone.")) return;
        const updatedBin = recycleBin.filter(b => b.id !== itemId);
        saveRecycleBin(updatedBin);
    };

    const handleClearRecycleBin = () => {
        if (!window.confirm("Are you sure you want to empty the Recycle Bin? All deleted students will be permanently lost.")) return;
        saveRecycleBin([]);
    };

    // ─── Download CSV Template ────────────────────────────────────────────────
    const downloadCsvTemplate = () => {
        const headers = 'Name,Email,Phone\n';
        const sampleData = 'Aarav Patel,aarav@email.com,+91 98001 00001\nRiya Sharma,riya@email.com,\nAnkit Verma,ankit@email.com,+91 98001 00003\n';
        const blob = new Blob([headers + sampleData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'kfa_students_bulk_enroll_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

    const allUnassignedStudents = React.useMemo(() => {
        const map = new Map<string, StudentData>();
        
        unassignedStudents.forEach(s => {
            map.set(s.id, s);
        });

        students.forEach(s => {
            if (!s.teacher_id || s.teacher_name === 'Unassigned' || s.batch === 'Unassigned') {
                map.set(s.id, s);
            }
        });
        
        return Array.from(map.values());
    }, [students, unassignedStudents]);

    const displayedStudents = React.useMemo(() => {
        let result = filterMode === 'unassigned' ? [...allUnassignedStudents] : [...students];

        if (filterMode !== 'unassigned') {
            if (selectedBatch !== 'All Batches') {
                result = result.filter(s => s.batch === selectedBatch);
            }

            if (statusFilter !== 'all') {
                if (statusFilter === 'archived' || statusFilter === 'inactive') {
                    result = result.filter(s => s.status.toLowerCase() === 'archived' || s.status.toLowerCase() === 'inactive');
                } else {
                    result = result.filter(s => s.status.toLowerCase() === statusFilter);
                }
            }
        }

        if (filterMode === 'recent' || filterMode === 'unassigned') {
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
            const matchesSearch = (s: StudentData) => 
                s.name.toLowerCase().includes(lowerQuery) || 
                s.student_id_formatted.toLowerCase().includes(lowerQuery) ||
                (s.email && s.email.toLowerCase().includes(lowerQuery)) ||
                (s.phone && s.phone.toLowerCase().includes(lowerQuery)) ||
                (s.batch && s.batch.toLowerCase().includes(lowerQuery)) ||
                (s.teacher_name && s.teacher_name.toLowerCase().includes(lowerQuery));

            const filteredTabResult = result.filter(matchesSearch);

            // If searching on Unassigned/Recent tab yields 0 matches, search across ALL students so assigned students aren't hidden
            if (filteredTabResult.length === 0) {
                return students.filter(matchesSearch);
            }

            return filteredTabResult;
        }

        return result;
    }, [students, allUnassignedStudents, filterMode, selectedBatch, statusFilter, searchQuery]);

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
                                Are you sure you want to delete <span className="font-bold text-slate-700 dark:text-slate-300">{studentToDelete.name}</span>? This will move them to the Recycle Bin, from which they can be restored later.
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
                                This will move <span className="font-bold text-rose-600">{selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''}</span> to the Recycle Bin. You will be able to restore them later if needed.
                            </p>
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

            {/* ─── Recycle Bin Modal ──────────────────────────────────────────────── */}
            {showRecycleBin && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#ecb613] text-2xl">delete_sweep</span>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Student Recycle Bin</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                {recycleBin.length > 0 && (
                                    <button
                                        onClick={handleClearRecycleBin}
                                        className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-450 dark:hover:bg-rose-900/30 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-sm">delete_forever</span>
                                        Empty Bin
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowRecycleBin(false)}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-650 transition-colors"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 max-h-[400px] overflow-y-auto space-y-3">
                            {recycleBin.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <span className="material-symbols-outlined text-5xl mb-2 text-slate-300 dark:text-slate-700">delete_outline</span>
                                    <p className="text-sm font-semibold">Your recycle bin is empty.</p>
                                    <p className="text-xs text-slate-400 mt-1">Deleted students will show up here to be restored if needed.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {recycleBin.map((item) => (
                                        <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    Joined: {item.student.join_date || 'N/A'} • Deleted: {new Date(item.deletedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleRestoreStudent(item)}
                                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                                                    title="Restore Student"
                                                >
                                                    <span className="material-symbols-outlined text-sm">settings_backup_restore</span>
                                                    Restore
                                                </button>
                                                <button
                                                    onClick={() => handlePermanentDeleteStudent(item.id)}
                                                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                                                    title="Delete Permanently"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => setShowRecycleBin(false)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Claim & Assign Student Modal ─────────────────────────────────────── */}
            {showClaimModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-2xl">person_add</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Claim Student</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                                You are about to approve <span className="font-bold text-slate-700 dark:text-slate-300">{showClaimModal.name}</span>. Please assign them to a batch so their student dashboard can unlock.
                            </p>
                            
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Select Batch</label>
                                <select
                                    value={claimBatchId}
                                    onChange={e => {
                                        const newBatchId = e.target.value;
                                        setClaimBatchId(newBatchId);
                                        if (teacherProfile?.role === 'admin') {
                                            const room = classrooms.find(c => c.id === newBatchId);
                                            if (room?.teacher_id) {
                                                setClaimTeacherId(room.teacher_id);
                                            }
                                        }
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                >
                                    <option value="" disabled>Choose a batch...</option>
                                    {sortClassroomsByDayAndTime(classrooms).map(room => (
                                        <option key={room.id} value={room.id}>{room.name}</option>
                                    ))}
                                </select>
                            </div>

                            {teacherProfile?.role === 'admin' && (
                                <div className="space-y-2 mt-4">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Select Teacher</label>
                                    <select
                                        value={claimTeacherId}
                                        onChange={e => setClaimTeacherId(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                    >
                                        <option value="" disabled>Choose a teacher...</option>
                                        {teachers.map(teacher => (
                                            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                            <button 
                                onClick={() => { setShowClaimModal(null); setClaimBatchId(''); }}
                                disabled={claimingId === showClaimModal.id}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                                Cancel
                            </button>
                            <button 
                                onClick={claimStudent}
                                disabled={claimingId === showClaimModal.id || !claimBatchId || (teacherProfile?.role === 'admin' && !claimTeacherId)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
                                {claimingId === showClaimModal.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <span className="material-symbols-outlined text-lg">check_circle</span>
                                )}
                                {claimingId === showClaimModal.id ? 'Approving...' : 'Approve & Assign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Reactivate Student Modal ─────────────────────────────────────── */}
            {showReactivateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-2xl">unarchive</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Reactivate Student</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                                You are reactivating <span className="font-bold text-slate-700 dark:text-slate-300">{showReactivateModal.name}</span>. Please select which classroom batch to allocate them to:
                            </p>
                            
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Target Classroom Batch</label>
                                <select
                                    value={reactivateBatchId}
                                    onChange={e => setReactivateBatchId(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none font-bold"
                                >
                                    <option value="" disabled>Select classroom batch...</option>
                                    {classrooms
                                        .filter(room => !room.name.toLowerCase().includes('learning circle'))
                                        .map(room => (
                                            <option key={room.id} value={room.id}>{room.name}</option>
                                        ))}
                                </select>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                            <button 
                                onClick={() => { setShowReactivateModal(null); setReactivateBatchId(''); }}
                                disabled={isReactivating}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                                Cancel
                            </button>
                            <button 
                                onClick={confirmReactivateStudent}
                                disabled={isReactivating || !reactivateBatchId}
                                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50 flex items-center gap-2">
                                {isReactivating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <span className="material-symbols-outlined text-lg">unarchive</span>
                                )}
                                {isReactivating ? 'Reactivating...' : 'Reactivate & Allocate'}
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
                                                {sortClassroomsByDayAndTime(classrooms).map(room => (
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
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-base">info</span>
                                                CSV Format
                                            </p>
                                            <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">Name, Email, Phone (optional)</p>
                                            <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">Supports comma or tab-separated values. First row header is auto-detected.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={downloadCsvTemplate}
                                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-[#ecb613] hover:bg-[#d8a310] text-slate-900 text-xs font-bold rounded-lg shadow-sm transition-all"
                                        >
                                            <span className="material-symbols-outlined text-sm">download</span>
                                            Template CSV
                                        </button>
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
                        avatarUrl={teacherProfile?.profile_pic_url}
                        userName={teacherProfile?.name}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        backLink={teacherProfile?.role === 'admin' ? '/admin-dashboard' : '/teacher-dashboard'}
                    />

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                        <div className="w-full grid grid-cols-12 gap-8">
                            <div className="col-span-12 lg:col-span-8 space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Student Directory</h2>
                                        <p className="text-sm text-slate-500 mt-1">Manage and track progress for {students.length} enrolled students.</p>
                                    </div>
                                    {(teacherProfile?.role === 'admin' || teacherProfile?.role === 'teacher') && (
                                        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                                            <button
                                                onClick={() => setShowRecycleBin(true)}
                                                className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 sm:px-4 h-10 sm:h-11 rounded-lg text-xs sm:text-sm font-bold shadow-xs transition-all border border-slate-200 dark:border-slate-700"
                                                title="Recycle Bin (Deleted Students)"
                                            >
                                                <span className="material-symbols-outlined text-base sm:text-lg">delete_sweep</span>
                                                <span className="truncate">Recycle Bin ({recycleBin.length})</span>
                                            </button>
                                            <Link
                                                href="/teacher-dashboard/students/add"
                                                className="bg-black dark:bg-[#ecb613] dark:text-slate-900 hover:bg-slate-800 text-white px-3 sm:px-5 h-10 sm:h-11 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all whitespace-nowrap"
                                            >
                                                <span className="material-symbols-outlined text-base sm:text-lg">person_add</span>
                                                <span className="truncate">Add New Student</span>
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                {/* ── Pending Signup Requests Banner ────────────────── */}
                                {pendingUsers.length > 0 && (
                                    <div className="rounded-xl border border-amber-300/80 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-700/80 overflow-hidden shadow-xs">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-amber-100/70 dark:bg-amber-900/30 border-b border-amber-200/80 dark:border-amber-700/80">
                                            <div className="flex items-center gap-2">
                                                <span className="relative flex h-2.5 w-2.5 shrink-0">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                                </span>
                                                <span className="font-bold text-xs sm:text-sm text-amber-900 dark:text-amber-300">
                                                    {pendingUsers.length} New Registration Request{pendingUsers.length !== 1 ? 's' : ''} Awaiting Approval
                                                </span>
                                            </div>
                                            <Link
                                                href="/teacher-dashboard/role-allocation"
                                                className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1 shrink-0 self-start sm:self-auto"
                                            >
                                                Go to Role Allocation →
                                            </Link>
                                        </div>
                                        <div className="divide-y divide-amber-100 dark:divide-amber-900/30">
                                            {pendingUsers.slice(0, 5).map(u => (
                                                <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:px-4 sm:py-3 gap-3">
                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                        <div className="w-10 h-10 rounded-full bg-amber-200/80 dark:bg-amber-800/80 flex items-center justify-center text-amber-900 dark:text-amber-100 font-black text-sm shrink-0 border border-amber-300/50">
                                                            {u.name?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between sm:justify-start gap-2">
                                                                <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{u.name}</p>
                                                                <span className="text-[11px] font-medium text-slate-400 shrink-0 sm:hidden">
                                                                    {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-amber-200/40 dark:border-amber-900/20">
                                                        <span className="text-xs font-medium text-slate-400 hidden sm:inline">
                                                            {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                        <Link
                                                            href="/teacher-dashboard/role-allocation"
                                                            className="w-full sm:w-auto text-center text-xs bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white px-4 py-2 sm:py-1.5 rounded-lg font-bold transition-all shadow-xs whitespace-nowrap shrink-0"
                                                        >
                                                            Assign Role
                                                        </Link>
                                                    </div>
                                                </div>
                                            ))}
                                            {pendingUsers.length > 5 && (
                                                <div className="px-4 py-2.5 text-center bg-amber-50/50 dark:bg-amber-950/10">
                                                    <Link href="/teacher-dashboard/role-allocation" className="text-xs text-amber-800 dark:text-amber-400 font-bold hover:underline">
                                                        View all {pendingUsers.length} pending requests →
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

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
                                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-800/50">
                                        {/* Row 1: Filter tabs and export button */}
                                        <div className="flex items-center justify-between gap-3 w-full">
                                            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-850 overflow-x-auto scrollbar-none snap-x flex-1 max-w-sm sm:flex-initial">
                                                <button 
                                                    onClick={() => setFilterMode('all')}
                                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shrink-0 snap-start ${filterMode === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-650 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>All Students</button>
                                                <button 
                                                    onClick={() => setFilterMode('recent')}
                                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shrink-0 snap-start ${filterMode === 'recent' ? 'bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-650 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Recent</button>
                                                {teacherProfile && (
                                                    <button 
                                                        onClick={() => setFilterMode('unassigned')}
                                                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shrink-0 snap-start ${filterMode === 'unassigned' ? 'bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-650 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Unassigned ({allUnassignedStudents.length})</button>
                                                )}
                                            </div>
                                            <button 
                                                onClick={handleExportCSV}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all focus:ring-2 focus:ring-[#ecb613]/50 shrink-0">
                                                <span className="material-symbols-outlined text-lg">download</span>
                                                <span className="hidden sm:inline">Export</span>
                                            </button>
                                        </div>

                                        {/* Row 2: Selectors (only visible when not viewing unassigned) */}
                                        {filterMode !== 'unassigned' && (
                                            <div className="grid grid-cols-2 gap-3 w-full sm:flex sm:items-center sm:w-auto">
                                                <div className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-xs flex items-center justify-between">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase select-none mr-2">Batch:</span>
                                                    <select 
                                                        value={selectedBatch} 
                                                        onChange={(e) => setSelectedBatch(e.target.value)} 
                                                        className="text-xs font-bold bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 py-1 pl-1 pr-6 cursor-pointer flex-1 outline-none">
                                                        <option value="All Batches">All Batches</option>
                                                        {availableBatches.map(batch => (
                                                            <option key={batch} value={batch}>{batch}</option>
                                                        ))}
                                                        <option value="Unassigned">Unassigned</option>
                                                    </select>
                                                </div>
                                                <div className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-xs flex items-center justify-between">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase select-none mr-2">Status:</span>
                                                    <select 
                                                        value={statusFilter} 
                                                        onChange={(e) => setStatusFilter(e.target.value as any)} 
                                                        className="text-xs font-bold bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 py-1 pl-1 pr-6 cursor-pointer flex-1 outline-none">
                                                        <option value="all">All Status</option>
                                                        <option value="active">Active Only</option>
                                                        <option value="inactive">Inactive</option>
                                                        <option value="archived">Archived</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                            {/* Mobile Cards View */}
                                            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                                                {paginatedStudents.map((student) => (
                                                    <div 
                                                        key={student.id} 
                                                        className={`p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors ${selectedIds.has(student.id) ? 'bg-rose-50/60 dark:bg-rose-900/10' : ''}`}
                                                    >
                                                        {/* Left side: checkbox, avatar & text details */}
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            {filterMode !== 'unassigned' && (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedIds.has(student.id)}
                                                                    onChange={() => toggleSelectStudent(student.id)}
                                                                    className="size-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/20 cursor-pointer shrink-0"
                                                                />
                                                            )}
                                                            <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700/50 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                                                                {student.profile_pic_url ? (
                                                                    <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-amber-800 dark:text-amber-300 font-black text-xs">{student.name?.charAt(0)?.toUpperCase() || '?'}</span>
                                                                )}
                                                            </div>
                                                            <Link href={`/teacher-dashboard/students/${student.id}`} className="min-w-0 flex-1 cursor-pointer">
                                                                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                                    {student.name}
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                                                    <span className="truncate">{student.batch}</span>
                                                                    {teacherProfile?.role === 'admin' && student.teacher_name && (
                                                                        <span className="truncate">• {student.teacher_name}</span>
                                                                    )}
                                                                </div>
                                                            </Link>
                                                        </div>

                                                        {/* Right side: Edit & Delete icons */}
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {filterMode === 'unassigned' ? (
                                                                <button
                                                                    onClick={() => setShowClaimModal(student)}
                                                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                                                                >
                                                                    <span className="material-symbols-outlined text-base">person_add</span>
                                                                    Claim
                                                                </button>
                                                            ) : (
                                                                <>
                                                                    <Link
                                                                        href={`/teacher-dashboard/students/${student.id}/edit`}
                                                                        className="p-2 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all flex items-center justify-center"
                                                                        title="Edit Profile"
                                                                    >
                                                                        <span className="material-symbols-outlined text-xl">edit</span>
                                                                    </Link>
                                                                    {teacherProfile?.role === 'admin' && (
                                                                        <button
                                                                            onClick={() => setStudentToDelete({ id: student.id, name: student.name })}
                                                                            className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all flex items-center justify-center"
                                                                            title="Delete Student"
                                                                        >
                                                                            <span className="material-symbols-outlined text-xl">delete</span>
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                {paginatedStudents.length === 0 && (
                                                    <div className="p-6 text-center text-slate-500 text-xs">
                                                        {filterMode === 'unassigned' ? 'No unassigned students waiting to be claimed.' : 'No students found in your directory.'}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Desktop Table View */}
                                            <div className="hidden md:block overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                                                            <th className="px-4 py-4 w-10">
                                                                {filterMode !== 'unassigned' ? (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={allPageSelected}
                                                                        ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                                                                        onChange={toggleSelectAll}
                                                                        className="size-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/20 cursor-pointer"
                                                                    />
                                                                ) : (
                                                                    <span className="text-slate-400">—</span>
                                                                )}
                                                            </th>
                                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name</th>
                                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Batch</th>
                                                            {teacherProfile?.role === 'admin' && (
                                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Teacher</th>
                                                            )}
                                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance</th>
                                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {paginatedStudents.map((student) => (
                                                            <tr key={student.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group ${selectedIds.has(student.id) ? 'bg-rose-50/60 dark:bg-rose-900/10' : ''}`}>
                                                                <td className="px-4 py-4">
                                                                    {filterMode !== 'unassigned' ? (
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedIds.has(student.id)}
                                                                            onChange={() => toggleSelectStudent(student.id)}
                                                                            className="size-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/20 cursor-pointer"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="relative shrink-0">
                                                                            <div className="size-10 rounded-full bg-[#ecb613]/10 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm">
                                                                                {student.profile_pic_url ? (
                                                                                    <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover rounded-full" loading="lazy" />
                                                                                ) : (
                                                                                    <span className="text-sm font-bold text-[#ecb613]">{student.name.charAt(0)}</span>
                                                                                )}
                                                                            </div>
                                                                            {student.is_online && (
                                                                                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800 animate-pulse" />
                                                                            )}
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <Link href={`/teacher-dashboard/students/${student.id}`} className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors whitespace-nowrap block">
                                                                                {student.name}
                                                                            </Link>
                                                                            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-tight whitespace-nowrap block">{student.student_id_formatted}</p>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4"><span className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">{student.batch}</span></td>
                                                                {teacherProfile?.role === 'admin' && (
                                                                    <td className="px-6 py-4"><span className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">{student.teacher_name || 'Unassigned'}</span></td>
                                                                )}
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm font-bold">{student.attendance_pct}%</span>
                                                                        <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                                            <div className={`h-1.5 rounded-full ${student.attendance_pct >= 85 ? 'bg-emerald-500' : student.attendance_pct >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${student.attendance_pct}%` }} />
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                                        student.pacing_status === 'Consistent' 
                                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                                                            : student.pacing_status === 'Improving'
                                                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                                    }`}>
                                                                        <span className={`size-1.5 rounded-full ${
                                                                            student.pacing_status === 'Consistent' 
                                                                                ? 'bg-emerald-500' 
                                                                                : student.pacing_status === 'Improving'
                                                                                    ? 'bg-amber-500'
                                                                                    : 'bg-rose-500'
                                                                        }`} />
                                                                        {student.pacing_status || 'Consistent'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                                        {student.phone || 'No Phone'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    {filterMode === 'unassigned' ? (
                                                                        <div className="flex justify-end">
                                                                            <button onClick={() => setShowClaimModal(student)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 hover:scale-[1.02] active:scale-95">
                                                                                <span className="material-symbols-outlined text-sm">person_add</span>
                                                                                Claim
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <Link href={`/teacher-dashboard/students/${student.id}/edit`} className="p-2 text-slate-400 hover:text-[#ecb613] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all" title="Edit profile"><span className="material-symbols-outlined text-xl">edit</span></Link>
                                                                            <button 
                                                                                onClick={() => router.push(`/teacher-dashboard/messages?chat=${student.id}`)}
                                                                                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all" 
                                                                                title="Message"
                                                                            >
                                                                                <span className="material-symbols-outlined text-xl">chat</span>
                                                                            </button>
                                                                            <button onClick={() => setStudentToDelete({ id: student.id, name: student.name })} className="p-2 text-rose-500 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all" title="Delete"><span className="material-symbols-outlined text-xl">delete</span></button>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {paginatedStudents.length === 0 && (
                                                            <tr>
                                                                <td colSpan={teacherProfile?.role === 'admin' ? 8 : 7} className="px-6 py-10 text-center text-slate-500">
                                                                    {filterMode === 'unassigned' ? 'No unassigned students waiting to be claimed.' : 'No students found in your directory.'}
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
                                            {(teacherProfile?.role === 'admin' || teacherProfile?.role === 'teacher') && (
                                                <>
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
                                                </>
                                            )}
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
