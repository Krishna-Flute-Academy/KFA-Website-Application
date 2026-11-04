'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../../src/lib/supabase-auth';
import { sendClassroomNotification } from '../../../../src/lib/notifications';
import { Loader2, ArrowLeft, Search, UserPlus, Clock, Info, CheckCircle2, Video, X, Users } from 'lucide-react';
import Link from 'next/link';
import TeacherSidebar from '../../../../src/components/TeacherSidebar';
import { fetchAcademyTeachers } from '../../../../src/lib/teachers';
import { createSpecialSession, getDefaultCreditTreatment, SpecialSessionPurpose } from '../../../../src/lib/special-sessions';
import { buildAlternativeClassName } from '../../../../src/lib/alternative-class-sessions';
import { serializeClassroomDescription, isValidMeetingUrl } from '../../../../src/lib/meeting-utils';
import { isStudentOperationallyActive } from '../../../../src/lib/student-lifecycle';
import { sortClassroomsByDayAndTime } from '../../../../src/lib/classroomSort';

interface Student {
    id: string;
    user_id: string;
    name: string;
    level: string;
    profile_pic_url?: string;
    batchName?: string;
}

interface ExistingBatch {
    id: string;
    name: string;
    teacher_id?: string | null;
    studentIds: string[];
}

export default function CreateClassPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);
    const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [existingBatches, setExistingBatches] = useState<ExistingBatch[]>([]);
    const [selectedBatchImportId, setSelectedBatchImportId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [studentMissedDates, setStudentMissedDates] = useState<Record<string, string>>({});
    const [activeHolidays, setActiveHolidays] = useState<any[]>([]);
    const [selectedHolidayId, setSelectedHolidayId] = useState<string>('');

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        deliveryFormat: 'offline',
        meetingLink: '',
        type: 'permanent' as 'permanent' | 'temporary',
        purpose: 'makeup' as 'makeup' | 'extra_class' | 'revision' | 'practice' | 'other',
        creditTreatment: 'makeup' as 'complimentary' | 'makeup' | 'consume_credit',
        selectedDays: [] as number[], // 0=Sun, 1=Mon, ..., 6=Sat
        classDate: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '11:00',
        teacherId: ''
    });

    function formatTime12hr(time24: string) {
        if (!time24) return '';
        const [h, m] = time24.split(':');
        let hours = parseInt(h, 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${hours}:${m} ${ampm}`;
    }

    function addOneHour(timeStr: string): string {
        if (!timeStr) return '';
        const parts = timeStr.split(':');
        if (parts.length < 2) return '';
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (isNaN(h) || isNaN(m)) return '';
        const newHour = (h + 1) % 24;
        return `${String(newHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    const generateTimeOptions = () => {
        const options = [];
        for (let h = 6; h <= 22; h++) {
            for (let m = 0; m < 60; m += 15) {
                const hStr = h.toString().padStart(2, '0');
                const mStr = m.toString().padStart(2, '0');
                const value = `${hStr}:${mStr}`;
                options.push({ value, label: formatTime12hr(value) });
            }
        }
        return options;
    };
    const TIME_OPTIONS = generateTimeOptions();

    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const toggleDay = (day: number) => {
        setFormData(prev => ({
            ...prev,
            selectedDays: prev.selectedDays.includes(day)
                ? prev.selectedDays.filter(d => d !== day)
                : [...prev.selectedDays, day].sort()
        }));
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const urlType = params.get('type');
            if (urlType === 'temporary' || urlType === 'special') {
                setFormData(prev => ({ ...prev, type: 'temporary' }));
            }
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Get Teacher Session
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                // 2. Fetch User Profile
                const { data: profile } = await supabaseAuth
                    .from('users')
                    .select('id, name, email, role')
                    .eq('id', session.user.id)
                    .single();

                if (!profile || profile.role !== 'admin') {
                    router.push('/teacher-dashboard');
                    return;
                }
                setTeacherProfile({ id: profile.id, name: profile.name, email: profile.email, role: profile.role });

                // 3. Fetch teachers and admins
                const teachersData = await fetchAcademyTeachers(supabaseAuth, profile.id);
                if (teachersData && teachersData.length > 0) {
                    setTeachers(teachersData);
                }

                // 4. Fetch Students and existing Permanent Classrooms + Rosters + Active Holidays
                const [
                    { data: studentsData, error: studentsError },
                    { data: classroomsData },
                    { data: rosterData },
                    { data: holidaysData }
                ] = await Promise.all([
                    supabaseAuth
                        .from('users')
                        .select(`
                            id,
                            name,
                            level,
                            status,
                            profile_pic_url
                        `)
                        .or('role.eq.student,role.eq.pending,role.eq.mentor'),
                    supabaseAuth
                        .from('classrooms')
                        .select('id, name, teacher_id, type, status'),
                    supabaseAuth
                        .from('classroom_students')
                        .select('classroom_id, student_id'),
                    supabaseAuth
                        .from('classroom_holidays')
                        .select('*')
                        .eq('status', 'active')
                        .in('holiday_type', ['alternative_pending', 'alternative_scheduled', 'with_alternative'])
                        .order('holiday_date', { ascending: false })
                ]);

                if (studentsError) throw studentsError;

                const activeStudentsRaw = (studentsData || []).filter((s: any) =>
                    isStudentOperationallyActive(s.status)
                );
                const activeStudentIdSet = new Set(activeStudentsRaw.map((s: any) => s.id));

                const activePermanentRooms = sortClassroomsByDayAndTime(
                    (classroomsData || []).filter((c: any) => {
                        const cType = (c.type || 'permanent').toLowerCase();
                        const cStatus = (c.status || 'active').toLowerCase();
                        return cType === 'permanent' && cStatus !== 'archived' && cStatus !== 'inactive';
                    })
                );

                const roomIdsByStudent = new Map<string, string[]>();
                const studentIdsByRoom = new Map<string, string[]>();
                (rosterData || []).forEach((r: any) => {
                    if (!activeStudentIdSet.has(r.student_id)) return;
                    if (!studentIdsByRoom.has(r.classroom_id)) studentIdsByRoom.set(r.classroom_id, []);
                    studentIdsByRoom.get(r.classroom_id)!.push(r.student_id);

                    if (!roomIdsByStudent.has(r.student_id)) roomIdsByStudent.set(r.student_id, []);
                    roomIdsByStudent.get(r.student_id)!.push(r.classroom_id);
                });

                const roomNameById = new Map<string, string>(
                    activePermanentRooms.map((c: any) => [c.id, c.name])
                );

                const batchesList: ExistingBatch[] = activePermanentRooms.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    teacher_id: c.teacher_id,
                    studentIds: studentIdsByRoom.get(c.id) || []
                }));
                setExistingBatches(batchesList);

                const holidaysWithRoomName = (holidaysData || []).map((h: any) => ({
                    ...h,
                    classroomName: roomNameById.get(h.classroom_id) || 'Classroom'
                }));
                setActiveHolidays(holidaysWithRoomName);

                if (typeof window !== 'undefined') {
                    const params = new URLSearchParams(window.location.search);
                    const urlHolidayId = params.get('holidayId');
                    const urlClassroomId = params.get('classroomId');
                    const urlHolidayDate = params.get('holidayDate');
                    const matchedHol = holidaysWithRoomName.find((h: any) =>
                        (urlHolidayId && h.id === urlHolidayId) ||
                        (urlClassroomId && urlHolidayDate && h.classroom_id === urlClassroomId && h.holiday_date === urlHolidayDate)
                    );
                    if (matchedHol) {
                        setSelectedHolidayId(matchedHol.id);
                        const batch = batchesList.find(b => b.id === matchedHol.classroom_id);
                        if (batch) {
                            setSelectedBatchImportId(batch.id);
                            setSelectedStudents(batch.studentIds);
                        }
                        setFormData(prev => ({
                            ...prev,
                            type: 'temporary',
                            name: prev.name || buildAlternativeClassName(matchedHol.classroomName),
                            teacherId: prev.teacherId || batch?.teacher_id || profile.id,
                            purpose: 'other',
                            creditTreatment: 'consume_credit',
                            classDate: matchedHol.alternative_date || prev.classDate
                        }));
                    }
                }

                const formattedStudents: Student[] = activeStudentsRaw.map((s: any) => {
                    const sRoomIds = roomIdsByStudent.get(s.id) || [];
                    const batchNames = sRoomIds.map(rid => roomNameById.get(rid)).filter(Boolean);
                    return {
                        id: s.id,
                        user_id: s.id,
                        name: s.name || 'Unknown Student',
                        level: s.level || 'beginner',
                        profile_pic_url: s.profile_pic_url,
                        batchName: batchNames.length > 0 ? batchNames.join(', ') : undefined
                    };
                });

                setStudents(formattedStudents);

            } catch (err) {
                console.error('Error fetching data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [router]);

    const checkSchedulingConflicts = async (
        teacherId: string,
        type: 'permanent' | 'temporary',
        selectedDays: number[],
        classDate: string,
        startTime: string,
        endTime: string
    ) => {
        const { data: classroomsRaw, error: classErr } = await supabaseAuth
            .from('classrooms')
            .select('id, name, type, status')
            .eq('teacher_id', teacherId);
        
        if (classErr) return null;
        const allTeacherRooms = classroomsRaw || [];
        const shadowStatusById = new Map<string, string>(
            allTeacherRooms.map((c: any) => [c.id, (c.status || 'active').toLowerCase()])
        );
        const activePermanentRooms = allTeacherRooms.filter((c: any) => {
            const cType = (c.type || 'permanent').toLowerCase();
            const cStatus = (c.status || 'active').toLowerCase();
            return cType === 'permanent' && cStatus !== 'archived' && cStatus !== 'inactive';
        });

        const classroomMap = new Map<string, string>(allTeacherRooms.map((c: any) => [c.id, c.name]));
        const permanentClassroomIds = activePermanentRooms.map((c: any) => c.id);

        const [schedRes, tempRes] = await Promise.all([
            permanentClassroomIds.length > 0
                ? supabaseAuth
                    .from('batch_schedules')
                    .select('classroom_id, day_of_week, start_time, end_time')
                    .in('classroom_id', permanentClassroomIds)
                : Promise.resolve({ data: [] as any[] }),
            supabaseAuth
                .from('temporary_classes')
                .select('classroom_id, title, class_date, start_time, end_time, lifecycle_status')
                .eq('teacher_id', teacherId)
        ]);

        const batchSchedules = schedRes.data || [];
        const temporaryClasses = (tempRes.data || []).filter((tc: any) => {
            const lifecycle = (tc.lifecycle_status || 'scheduled').toLowerCase();
            if (lifecycle === 'cancelled') return false;
            if (tc.classroom_id) {
                const shadowStatus = shadowStatusById.get(tc.classroom_id);
                if (shadowStatus === 'archived' || shadowStatus === 'inactive') return false;
            }
            return true;
        });

        const newStart = startTime.slice(0, 5);
        const newEnd = endTime.slice(0, 5);

        const checkOverlap = (s1: string, e1: string, s2: string, e2: string) => {
            return s1.slice(0, 5) < e2.slice(0, 5) && s2.slice(0, 5) < e1.slice(0, 5);
        };

        if (type === 'temporary') {
            // Check active temporary classes on the exact same date
            for (const tc of temporaryClasses) {
                if (tc.class_date === classDate && checkOverlap(newStart, newEnd, tc.start_time, tc.end_time)) {
                    return {
                        className: tc.title || classroomMap.get(tc.classroom_id) || 'Temporary Class',
                        type: 'temporary',
                        dayOrDate: classDate,
                        time: `${tc.start_time.slice(0, 5)} - ${tc.end_time.slice(0, 5)}`
                    };
                }
            }
        } else {
            // Check for each selected day of the permanent class
            for (const day of selectedDays) {
                for (const bs of batchSchedules) {
                    if (bs.day_of_week === day && checkOverlap(newStart, newEnd, bs.start_time, bs.end_time)) {
                        return {
                            className: classroomMap.get(bs.classroom_id) || 'Permanent Class',
                            type: 'permanent',
                            dayOrDate: DAY_FULL[day],
                            time: `${bs.start_time.slice(0, 5)} - ${bs.end_time.slice(0, 5)}`
                        };
                    }
                }
            }
        }
        return null;
    };

    const handleCreateClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teacherProfile) return;
        if (!formData.name) {
            alert('Please enter a class name.');
            return;
        }
        if (!formData.teacherId) {
            alert('Please select an instructor/teacher.');
            return;
        }
        if (formData.type === 'permanent' && formData.selectedDays.length === 0) {
            alert('Please select at least one schedule day.');
            return;
        }

        setSubmitting(true);
        try {
            // Check for scheduling conflicts
            const conflict = await checkSchedulingConflicts(
                formData.teacherId,
                formData.type as 'permanent' | 'temporary',
                formData.selectedDays,
                formData.classDate,
                formData.startTime,
                formData.endTime
            );

            if (conflict) {
                alert(`Scheduling Conflict: This instructor is already allocated to "${conflict.className}" (${conflict.type} class) on ${conflict.dayOrDate} at ${conflict.time}.`);
                setSubmitting(false);
                return;
            }
            if (formData.type === 'permanent') {
                // Build schedule text for display
                const scheduleText = formData.selectedDays.length > 0
                    ? formData.selectedDays.map(d => DAY_LABELS[d]).join(', ') + ` • ${formatTime12hr(formData.startTime)}`
                    : `${formatTime12hr(formData.startTime)}`;

                if (formData.deliveryFormat === 'online' && formData.meetingLink && !isValidMeetingUrl(formData.meetingLink)) {
                    alert('Please enter a valid meeting URL (e.g. https://meet.google.com/xyz or https://zoom.us/j/...)');
                    setSubmitting(false);
                    return;
                }

                const finalDescription = serializeClassroomDescription(
                    formData.description,
                    formData.deliveryFormat as 'offline' | 'online',
                    formData.deliveryFormat === 'online' ? formData.meetingLink : undefined
                );

                // 1. Create Permanent Classroom
                const { data: classroom, error: classroomError } = await supabaseAuth
                    .from('classrooms')
                    .insert([{
                        teacher_id: formData.teacherId,
                        name: formData.name,
                        description: finalDescription,
                        type: formData.type
                    }])
                    .select()
                    .single();

                if (classroomError) throw classroomError;

                // 2. Insert Batch Schedules for each selected day
                if (formData.selectedDays.length > 0) {
                    const schedules = formData.selectedDays.map(day => ({
                        classroom_id: classroom.id,
                        day_of_week: day,
                        start_time: formData.startTime,
                        end_time: formData.endTime
                    }));
                    const { error: schedError } = await supabaseAuth
                        .from('batch_schedules')
                        .insert(schedules);
                    if (schedError) console.error('Error inserting batch schedules:', schedError);
                }

                // 3. Assign Students
                if (selectedStudents.length > 0) {
                    // Delete these students from any other classrooms first to enforce one classroom per student
                    await supabaseAuth
                        .from('classroom_students')
                        .delete()
                        .in('student_id', selectedStudents);

                    const assignments = selectedStudents.map(studentId => ({
                        classroom_id: classroom.id,
                        student_id: studentId,
                        joined_at: new Date().toISOString()
                    }));

                    const { error: assignmentError } = await supabaseAuth
                        .from('classroom_students')
                        .insert(assignments);

                    if (assignmentError) throw assignmentError;
                }

                // Notify Teacher, Students, and Admins for permanent class
                try {
                    const { data: admins } = await supabaseAuth
                        .from('users')
                        .select('id')
                        .eq('role', 'admin')
                        .eq('status', 'active');
                    
                    const adminIds = (admins || []).map(a => a.id);
                    const recipientIds = Array.from(new Set([
                        formData.teacherId,
                        ...selectedStudents,
                        ...adminIds
                    ]));

                    if (recipientIds.length > 0) {
                        const teacherName = teachers.find(t => t.id === formData.teacherId)?.name || 'Teacher';
                        const title = `New Class Created: ${formData.name}`;
                        const message = `A new permanent class "${formData.name}" has been created with teacher ${teacherName}.`;

                        await sendClassroomNotification({
                            teacherId: formData.teacherId,
                            recipients: [],
                            title,
                            message,
                            studentIds: recipientIds
                        });
                    }
                } catch (notifyErr) {
                    console.error('Error sending creation notifications:', notifyErr);
                }
            } else {
                if (formData.deliveryFormat === 'online' && formData.meetingLink && !isValidMeetingUrl(formData.meetingLink)) {
                    alert('Please enter a valid meeting URL (e.g. https://meet.google.com/xyz or https://zoom.us/j/...)');
                    setSubmitting(false);
                    return;
                }

                const linkedHoliday = selectedHolidayId
                    ? activeHolidays.find((h: any) => h.id === selectedHolidayId)
                    : null;
                const holidayMetadataTag = linkedHoliday
                    ? ` [OnBehalfOfHoliday:${linkedHoliday.holiday_date}][HolidayClassroom:${linkedHoliday.classroom_id}][HolidayId:${linkedHoliday.id}]`
                    : '';

                if (linkedHoliday) {
                    // Prevent duplicate alternative Special Sessions for the same holiday
                    const { data: existingAlt } = await supabaseAuth
                        .from('classrooms')
                        .select('id, name, status')
                        .eq('type', 'temporary')
                        .ilike('description', `%[HolidayId:${linkedHoliday.id}]%`);
                    const activeAlt = (existingAlt || []).find((r: any) => (r.status || 'active').toLowerCase() !== 'archived');
                    if (activeAlt) {
                        alert(`An alternative class "${activeAlt.name}" already exists for this holiday. Reschedule it from the holiday instead of creating a new one.`);
                        setSubmitting(false);
                        return;
                    }
                }

                // Canonical Special Session creation via shared service
                await createSpecialSession(supabaseAuth, {
                    teacherId: formData.teacherId,
                    name: formData.name,
                    description: `${formData.description || ''}${holidayMetadataTag}`.trim(),
                    deliveryFormat: formData.deliveryFormat as 'offline' | 'online',
                    meetingLink: formData.deliveryFormat === 'online' ? formData.meetingLink : undefined,
                    classDate: formData.classDate,
                    startTime: formData.startTime,
                    endTime: formData.endTime,
                    purpose: formData.purpose,
                    creditTreatment: linkedHoliday ? 'consume_credit' : formData.creditTreatment,
                    selectedStudents: selectedStudents,
                    studentMissedDates: studentMissedDates
                });

                if (linkedHoliday) {
                    const { error: schedHolErr } = await supabaseAuth.rpc('schedule_holiday_alternative', {
                        p_holiday_id: linkedHoliday.id,
                        p_alternative_date: formData.classDate,
                        p_alt_start_time: formData.startTime ? `${formData.startTime}:00` : null,
                        p_alt_end_time: formData.endTime ? `${formData.endTime}:00` : null,
                        p_reason: formData.name || 'Special Session created on behalf of holiday'
                    });
                    if (schedHolErr) {
                        console.error('Error linking special session to holiday:', schedHolErr);
                    }
                }
            }

            if (typeof window !== 'undefined') {
                localStorage.removeItem('kfa_classrooms_cache');
            }
            alert(`${formData.type === 'permanent' ? 'Permanent Class' : 'Special Session'} created successfully!`);
            router.push(formData.type === 'temporary' ? '/teacher-dashboard/classrooms?view=temporary' : '/teacher-dashboard/classrooms');

        } catch (err: any) {
            const errStr = err?.message || err?.details || err?.hint || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            console.error('Error creating class details:', errStr, err);
            alert(`Failed to create class: ${errStr}`);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleStudent = (id: string) => {
        setSelectedStudents(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 tracking-wide uppercase text-xs">Loading Form...</p>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#f8f8f6] dark:bg-[#221d10] text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                {/* Header */}
                <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-30 shrink-0">
                    <div className="flex items-center gap-4">
                        <Link href="/teacher-dashboard/classrooms" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors group">
                            <ArrowLeft className="size-5 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white" />
                        </Link>
                        <h2 className="text-lg font-bold tracking-tight">Create New Class</h2>
                    </div>
                </header>

                <div className="p-8 max-w-[1400px] mx-auto w-full">
                    <div className="mb-8">
                        <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">Configure New Class</h3>
                        <p className="text-slate-500 dark:text-slate-400">Fill in the administrative details to initialize a new training session for the academy.</p>
                    </div>

                    <form onSubmit={handleCreateClass} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Form Section */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="grid grid-cols-1 gap-6">
                                    {/* Class Type & Scheduling (Moved to Top for Clarity) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Class Type</label>
                                            <div className="flex gap-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, type: 'permanent' })}
                                                    className={`flex-1 py-3 px-4 border rounded-xl font-bold text-sm transition-all cursor-pointer ${formData.type === 'permanent' ? 'border-[#ecb613] bg-[#ecb613]/10 text-[#ecb613]' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                                >
                                                    Permanent Class
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, type: 'temporary' })}
                                                    className={`flex-1 py-3 px-4 border rounded-xl font-bold text-sm transition-all cursor-pointer ${formData.type === 'temporary' ? 'border-[#ecb613] bg-[#ecb613]/10 text-[#ecb613]' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                                >
                                                    Special Session
                                                </button>
                                            </div>
                                        </div>
                                        {formData.type === 'permanent' ? (
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Schedule Days (Weekly)</label>
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {DAY_LABELS.map((label, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => toggleDay(idx)}
                                                            className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${formData.selectedDays.includes(idx) ? 'bg-[#ecb613] text-slate-900 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Session Date (Single Day)</label>
                                                <input
                                                    value={formData.classDate}
                                                    onChange={(e) => setFormData({ ...formData, classDate: e.target.value })}
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613]/50 focus:border-[#ecb613] outline-none transition-all text-sm font-medium"
                                                    type="date"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Class Name */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Class Name</label>
                                        <input
                                            value={formData.name}
                                            onChange={(e) => {
                                                const newName = e.target.value;
                                                const lower = newName.toLowerCase();
                                                const looksLikeSpecial =
                                                    lower.includes('alternative') ||
                                                    lower.includes('makeup') ||
                                                    lower.includes('make up') ||
                                                    lower.includes('special') ||
                                                    lower.includes('reschedule');
                                                setFormData(prev => ({
                                                    ...prev,
                                                    name: newName,
                                                    type: looksLikeSpecial ? 'temporary' : prev.type
                                                }));
                                            }}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613]/50 focus:border-[#ecb613] outline-none transition-all"
                                            placeholder="e.g. Morning Raag Basics - Intermediate"
                                            type="text"
                                        />
                                    </div>

                                    {/* Instructor/Teacher Assignment */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Assign Instructor (Teacher)</label>
                                        <div className="relative">
                                            <select
                                                required
                                                value={formData.teacherId}
                                                onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613]/50 focus:border-[#ecb613] outline-none transition-all appearance-none text-sm font-medium"
                                            >
                                                <option value="">Select a Teacher</option>
                                                {teachers.map(teacher => (
                                                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                                                ))}
                                            </select>
                                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Description</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613]/50 focus:border-[#ecb613] outline-none transition-all"
                                            placeholder="Detail the curriculum, objectives, and any required materials for this class..."
                                            rows={4}
                                        ></textarea>
                                    </div>

                                    {/* Special Session Options */}
                                    {formData.type === 'temporary' && (
                                        <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-4">
                                            <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider">
                                                <span>⚡ Special Session Configuration</span>
                                            </div>
                                            {/* Optional On Behalf Of Declared Holiday Selector (BR-22) */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                                                    🏖️ On Behalf Of Declared Holiday Class (Optional — BR-22)
                                                </label>
                                                <select
                                                    value={selectedHolidayId}
                                                    onChange={(e) => {
                                                        const holId = e.target.value;
                                                        setSelectedHolidayId(holId);
                                                        if (!holId) return;
                                                        const hol = activeHolidays.find((h: any) => h.id === holId);
                                                        if (hol) {
                                                            const batch = existingBatches.find(b => b.id === hol.classroom_id);
                                                            if (batch) {
                                                                setSelectedBatchImportId(batch.id);
                                                                setSelectedStudents(batch.studentIds);
                                                            }
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                type: 'temporary',
                                                                name: buildAlternativeClassName(hol.classroomName),
                                                                teacherId: prev.teacherId || batch?.teacher_id || prev.teacherId,
                                                                purpose: 'other',
                                                                creditTreatment: 'consume_credit',
                                                                classDate: hol.alternative_date || prev.classDate
                                                            }));
                                                        }
                                                    }}
                                                    className="w-full px-4 py-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613]/50 focus:border-[#ecb613] outline-none transition-all text-sm font-medium"
                                                >
                                                    <option value="">-- No (Regular Special Session / Makeup) --</option>
                                                    {activeHolidays.map((h: any) => (
                                                        <option key={h.id} value={h.id}>
                                                            🏖️ {h.classroomName} — Holiday on {h.holiday_date} ({h.holiday_type === 'alternative_pending' ? 'Alt Pending' : `Alt: ${h.alternative_date}`})
                                                        </option>
                                                    ))}
                                                </select>
                                                {selectedHolidayId && (
                                                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1.5">
                                                        ✓ This Special Session will be linked as the official replacement class for the selected holiday. Present/Late/Uninformed Absent will deduct 1 regular credit on behalf of the holiday class.
                                                    </p>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                                                        Session Purpose
                                                    </label>
                                                    <select
                                                        value={formData.purpose}
                                                        onChange={(e) => {
                                                            const nextPurpose = e.target.value as SpecialSessionPurpose;
                                                            setFormData({
                                                                ...formData,
                                                                purpose: nextPurpose,
                                                                creditTreatment: getDefaultCreditTreatment(nextPurpose)
                                                            });
                                                        }}
                                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613]/50 focus:border-[#ecb613] outline-none transition-all text-sm font-medium"
                                                    >
                                                        <option value="makeup">Makeup Class (Excused Absence)</option>
                                                        <option value="extra_class">Extra Class (Bonus)</option>
                                                        <option value="revision">Revision Session</option>
                                                        <option value="practice">Supervised Practice</option>
                                                        <option value="other">Other / Workshop</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                                                        Credit / Fee Treatment
                                                    </label>
                                                    <select
                                                        value={formData.creditTreatment}
                                                        onChange={(e) => setFormData({ ...formData, creditTreatment: e.target.value as any })}
                                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613]/50 focus:border-[#ecb613] outline-none transition-all text-sm font-medium"
                                                    >
                                                        <option value="makeup">Makeup (Reconciles 1 Missed Class)</option>
                                                        <option value="complimentary">Complimentary (No Credit Consumed)</option>
                                                        <option value="consume_credit">Consume Regular Monthly Credit</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Delivery Format */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Delivery Format</label>
                                        <div className="flex gap-4 max-w-xs mb-4">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, deliveryFormat: 'offline' })}
                                                className={`flex-1 py-3 px-4 border rounded-xl font-bold text-sm transition-all cursor-pointer text-center ${formData.deliveryFormat === 'offline' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                            >
                                                Offline (In-Person)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, deliveryFormat: 'online' })}
                                                className={`flex-1 py-3 px-4 border rounded-xl font-bold text-sm transition-all cursor-pointer text-center ${formData.deliveryFormat === 'online' ? 'border-blue-500 bg-blue-50 dark:bg-blue-955/20 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                            >
                                                Online
                                            </button>
                                        </div>

                                        {formData.deliveryFormat === 'online' && (
                                            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 space-y-2">
                                                <label className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wide">
                                                    <Video className="size-4 text-blue-600 dark:text-blue-400" />
                                                    Online Meeting Link (Optional)
                                                </label>
                                                <input
                                                    type="url"
                                                    value={formData.meetingLink}
                                                    onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                                                    placeholder="e.g. https://meet.google.com/xyz-abcd-efg or Zoom link"
                                                    className="w-full px-4 py-2.5 rounded-lg border border-blue-200 dark:border-blue-700/60 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                                />
                                                <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
                                                    Saved as the reusable default link for this classroom. Students with authorized access can join class calls directly from their portal.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Start Time</label>
                                            <div className="relative">
                                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 size-5 pointer-events-none" />
                                                <input
                                                    type="time"
                                                    value={formData.startTime}
                                                    onChange={(e) => {
                                                        const newStart = e.target.value;
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            startTime: newStart,
                                                            endTime: addOneHour(newStart)
                                                        }));
                                                    }}
                                                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613]/50 focus:border-[#ecb613] outline-none transition-all text-sm font-medium"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">End Time</label>
                                            <div className="relative">
                                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 size-5 pointer-events-none" />
                                                <input
                                                    type="time"
                                                    value={formData.endTime}
                                                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613]/50 focus:border-[#ecb613] outline-none transition-all text-sm font-medium"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-4 mt-8">
                                <Link href="/teacher-dashboard/classrooms">
                                    <button type="button" className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                        Cancel
                                    </button>
                                </Link>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-10 py-3 rounded-xl bg-[#ecb613] text-slate-900 font-bold shadow-lg shadow-[#ecb613]/20 hover:bg-[#ecb613]/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? <Loader2 className="size-5 animate-spin" /> : (formData.type === 'temporary' ? 'Create Special Session' : 'Create Permanent Class')}
                                </button>
                            </div>
                        </div>

                        {/* Student Selection Sidebar */}
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col min-h-[500px]">
                                <div className="mb-3">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <UserPlus className="size-5 text-[#ecb613]" />
                                        Assign Students
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-1">Select a batch or search individual students to enroll</p>
                                </div>

                                {/* Quick Import from Existing Batch */}
                                {existingBatches.length > 0 && (
                                    <div className="mb-3">
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <Users className="size-3.5 text-[#ecb613]" />
                                            Import Students from Batch (Optional)
                                        </label>
                                        <select
                                            value={selectedBatchImportId}
                                            onChange={(e) => {
                                                const batchId = e.target.value;
                                                setSelectedBatchImportId(batchId);
                                                if (!batchId) return;
                                                const batch = existingBatches.find(b => b.id === batchId);
                                                if (batch) {
                                                    setSelectedStudents(prev => Array.from(new Set([...prev, ...batch.studentIds])));
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        type: 'temporary',
                                                        teacherId: prev.teacherId || batch.teacher_id || ''
                                                    }));
                                                }
                                            }}
                                            className="w-full px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 focus:ring-1 focus:ring-[#ecb613]/50 outline-none"
                                        >
                                            <option value="">-- Select batch to add all its students --</option>
                                            {existingBatches.map(b => (
                                                <option key={b.id} value={b.id}>
                                                    {b.name} ({b.studentIds.length} {b.studentIds.length === 1 ? 'student' : 'students'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="relative mb-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
                                    <input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 focus:ring-1 focus:ring-[#ecb613]/50 outline-none"
                                        placeholder="Filter students..."
                                        type="text"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                            title="Clear search"
                                        >
                                            <X className="size-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] pr-2 custom-scrollbar">
                                    {filteredStudents.map((student) => {
                                        const isSelected = selectedStudents.includes(student.id);
                                        return (
                                            <div
                                                key={student.id}
                                                onClick={() => toggleStudent(student.id)}
                                                className={`flex flex-col gap-2 p-3 rounded-xl border cursor-pointer transition-all group ${isSelected ? 'border-[#ecb613] bg-[#ecb613]/5' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-4 rounded border flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-[#ecb613] border-[#ecb613]' : 'border-slate-300 dark:border-slate-600'}`}>
                                                        {isSelected && <CheckCircle2 className="size-3 text-white" />}
                                                    </div>
                                                    {student.profile_pic_url ? (
                                                        <img src={student.profile_pic_url} alt={student.name} className="size-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                                                    ) : (
                                                        <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                                                            {student.name.charAt(0)}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <span className="text-xs font-bold truncate">{student.name}</span>
                                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider truncate">
                                                            {student.level}{student.batchName ? ` • ${student.batchName}` : ''}
                                                        </span>
                                                    </div>
                                                </div>

                                                {isSelected && formData.type === 'temporary' && formData.purpose === 'makeup' && (
                                                    <div className="mt-1 pt-2 border-t border-amber-500/20" onClick={(e) => e.stopPropagation()}>
                                                        <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1 uppercase tracking-wider">
                                                            Missed Class Date (Optional):
                                                        </label>
                                                        <input
                                                            type="date"
                                                            value={studentMissedDates[student.id] || ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setStudentMissedDates(prev => ({ ...prev, [student.id]: val }));
                                                            }}
                                                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-[#ecb613] outline-none text-slate-800 dark:text-slate-100 font-medium"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {filteredStudents.length === 0 && (
                                        <div className="py-8 text-center">
                                            <p className="text-xs text-slate-500 italic">No students found.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex justify-between items-center text-xs font-bold mb-2">
                                        <span className="text-slate-500">Total Selected:</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[#ecb613]">{selectedStudents.length} {selectedStudents.length === 1 ? 'Student' : 'Students'}</span>
                                            {selectedStudents.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedStudents([]);
                                                        setSelectedBatchImportId('');
                                                    }}
                                                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 underline cursor-pointer"
                                                >
                                                    Clear All
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {selectedStudents.length > 0 && (
                                        <div className="mt-2 space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                                            {selectedStudents.map(sid => {
                                                const st = students.find(s => s.id === sid);
                                                if (!st) return null;
                                                return (
                                                    <div
                                                        key={sid}
                                                        className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-[#ecb613]/40"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                {st.profile_pic_url ? (
                                                                    <img src={st.profile_pic_url} alt={st.name} className="size-6 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                                                                ) : (
                                                                    <div className="size-6 rounded-full bg-[#ecb613]/20 flex items-center justify-center text-[10px] font-bold text-amber-800 dark:text-amber-300 shrink-0">
                                                                        {st.name.charAt(0)}
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{st.name}</span>
                                                                    <span className="text-[10px] text-slate-500 truncate">
                                                                        {st.batchName || st.level.toUpperCase()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleStudent(sid)}
                                                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0 cursor-pointer"
                                                                title={`Remove ${st.name}`}
                                                            >
                                                                <X className="size-3.5" />
                                                            </button>
                                                        </div>

                                                        {formData.type === 'temporary' && formData.purpose === 'makeup' && (
                                                            <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                                                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase shrink-0">
                                                                    Missed Date:
                                                                </span>
                                                                <input
                                                                    type="date"
                                                                    value={studentMissedDates[sid] || ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setStudentMissedDates(prev => ({ ...prev, [sid]: val }));
                                                                    }}
                                                                    className="flex-1 px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-[#ecb613] outline-none text-slate-800 dark:text-slate-100 font-medium"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
