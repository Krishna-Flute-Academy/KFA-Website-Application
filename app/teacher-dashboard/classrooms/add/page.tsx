'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../../src/lib/supabase-auth';
import { sendClassroomNotification } from '../../../../src/lib/notifications';
import { Loader2, ArrowLeft, Search, UserPlus, Clock, Info, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import TeacherSidebar from '../../../../src/components/TeacherSidebar';

interface Student {
    id: string;
    user_id: string;
    name: string;
    level: string;
    profile_pic_url?: string;
}

export default function CreateClassPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; role?: string } | null>(null);
    const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        deliveryFormat: 'offline',
        type: 'permanent',
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

                // 3. Fetch active teachers
                const { data: teachersData } = await supabaseAuth
                    .from('users')
                    .select('id, name')
                    .in('role', ['teacher', 'admin'])
                    .eq('status', 'active');
                if (teachersData) {
                    setTeachers(teachersData);
                }

                // 4. Fetch Students directly from users table
                const { data: studentsData, error: studentsError } = await supabaseAuth
                    .from('users')
                    .select(`
                        id,
                        name,
                        level,
                        profile_pic_url
                    `)
                    .or('role.eq.student,role.eq.pending');

                if (studentsError) throw studentsError;

                const formattedStudents = (studentsData || []).map((s: any) => ({
                    id: s.id,
                    user_id: s.id,
                    name: s.name || 'Unknown Student',
                    level: s.level || 'beginner',
                    profile_pic_url: s.profile_pic_url
                }));

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
        const { data: classrooms, error: classErr } = await supabaseAuth
            .from('classrooms')
            .select('id, name')
            .eq('teacher_id', teacherId);
        
        if (classErr || !classrooms || classrooms.length === 0) return null;
        const classroomMap = new Map<string, string>(classrooms.map(c => [c.id, c.name]));
        const classroomIds = classrooms.map(c => c.id);

        const [schedRes, tempRes] = await Promise.all([
            supabaseAuth
                .from('batch_schedules')
                .select('classroom_id, day_of_week, start_time, end_time')
                .in('classroom_id', classroomIds),
            supabaseAuth
                .from('temporary_classes')
                .select('classroom_id, title, class_date, start_time, end_time')
                .eq('teacher_id', teacherId)
        ]);

        const batchSchedules = schedRes.data || [];
        const temporaryClasses = tempRes.data || [];

        const newStart = startTime.slice(0, 5);
        const newEnd = endTime.slice(0, 5);

        const checkOverlap = (s1: string, e1: string, s2: string, e2: string) => {
            return s1.slice(0, 5) < e2.slice(0, 5) && s2.slice(0, 5) < e1.slice(0, 5);
        };

        if (type === 'temporary') {
            const targetDate = new Date(classDate);
            const targetDow = targetDate.getDay();

            // Check temporary classes on same date
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

            // Check permanent classes on same day of week
            for (const bs of batchSchedules) {
                if (bs.day_of_week === targetDow && checkOverlap(newStart, newEnd, bs.start_time, bs.end_time)) {
                    return {
                        className: classroomMap.get(bs.classroom_id) || 'Permanent Class',
                        type: 'permanent',
                        dayOrDate: DAY_FULL[targetDow],
                        time: `${bs.start_time.slice(0, 5)} - ${bs.end_time.slice(0, 5)}`
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

                for (const tc of temporaryClasses) {
                    const tcDate = new Date(tc.class_date);
                    const tcDow = tcDate.getDay();
                    if (tcDow === day && checkOverlap(newStart, newEnd, tc.start_time, tc.end_time)) {
                        return {
                            className: tc.title || classroomMap.get(tc.classroom_id) || 'Temporary Class',
                            type: 'temporary',
                            dayOrDate: `${DAY_FULL[day]} (${tc.class_date})`,
                            time: `${tc.start_time.slice(0, 5)} - ${tc.end_time.slice(0, 5)}`
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

                const formatTag = `[delivery_format:${formData.deliveryFormat}]`;
                const finalDescription = `${(formData.description || '').trim()} ${formatTag}`;

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
            } else {
                const formatTag = `[delivery_format:${formData.deliveryFormat}]`;
                const finalDescription = `${(formData.description || 'Temporary class session').trim()} ${formatTag}`;

                // 1. Create shadow Classroom first
                const { data: classroom, error: classroomError } = await supabaseAuth
                    .from('classrooms')
                    .insert([{
                        teacher_id: formData.teacherId,
                        name: formData.name,
                        description: finalDescription,
                        type: 'temporary'
                    }])
                    .select()
                    .single();

                if (classroomError) throw classroomError;

                // 2. Create Temporary Class
                const { data: tempClass, error: tempError } = await supabaseAuth
                    .from('temporary_classes')
                    .insert([{
                        teacher_id: formData.teacherId,
                        classroom_id: classroom.id,
                        title: formData.name,
                        class_date: formData.classDate,
                        start_time: formData.startTime,
                        end_time: formData.endTime
                    }])
                    .select()
                    .single();
                
                if (tempError) throw tempError;

                // 2. Assign Students to Temporary Class
                if (selectedStudents.length > 0) {
                    const studentInserts = selectedStudents.map(studentId => ({
                        student_id: studentId,
                        target_classroom_id: classroom.id,
                        override_date: formData.classDate,
                        reason: 'Temporary Class Session'
                    }));
                    const { error: tempAssignmentError } = await supabaseAuth
                        .from('session_student_overrides')
                        .insert(studentInserts);
                    if (tempAssignmentError) throw tempAssignmentError;
                }
            }

            // Notify Teacher, Students, and Admins
            try {
                // 1. Fetch active admins
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
                    const title = formData.type === 'permanent' 
                        ? `New Class Created: ${formData.name}`
                        : `New Temporary Session: ${formData.name}`;
                    const message = formData.type === 'permanent'
                        ? `A new permanent class "${formData.name}" has been created with teacher ${teacherName}.`
                        : `A new temporary class session "${formData.name}" has been scheduled for ${formData.classDate} from ${formatTime12hr(formData.startTime)} to ${formatTime12hr(formData.endTime)}.`;

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

            alert(`${formData.type === 'permanent' ? 'Permanent Class' : 'Temporary Session'} created successfully!`);
            router.push('/teacher-dashboard/classrooms');

        } catch (err: any) {
            console.error('Error creating class details:', err);
            let errorMessage = '';
            if (err && typeof err === 'object') {
                errorMessage = err.message || err.details || err.hint || JSON.stringify(err);
            } else {
                errorMessage = String(err);
            }
            alert(`Failed to create class: ${errorMessage}`);
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
                                    {/* Class Name */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Class Name</label>
                                        <input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

                                    {/* Class Type & Scheduling */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Class Type</label>
                                            <div className="flex gap-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, type: 'permanent' })}
                                                    className={`flex-1 py-3 px-4 border rounded-xl font-medium text-sm transition-all ${formData.type === 'permanent' ? 'border-[#ecb613] bg-[#ecb613]/10 text-[#ecb613]' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                                >
                                                    Permanent
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, type: 'temporary' })}
                                                    className={`flex-1 py-3 px-4 border rounded-xl font-medium text-sm transition-all ${formData.type === 'temporary' ? 'border-[#ecb613] bg-[#ecb613]/10 text-[#ecb613]' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                                >
                                                    Temporary
                                                </button>
                                            </div>
                                        </div>
                                        {formData.type === 'permanent' ? (
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Schedule Days</label>
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
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Class Date</label>
                                                <input
                                                    value={formData.classDate}
                                                    onChange={(e) => setFormData({ ...formData, classDate: e.target.value })}
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613]/50 focus:border-[#ecb613] outline-none transition-all text-sm font-medium"
                                                    type="date"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Delivery Format */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Delivery Format</label>
                                        <div className="flex gap-4 max-w-xs">
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
                                    {submitting ? <Loader2 className="size-5 animate-spin" /> : 'Create Class'}
                                </button>
                            </div>
                        </div>

                        {/* Student Selection Sidebar */}
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col min-h-[500px]">
                                <div className="mb-4">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <UserPlus className="size-5 text-[#ecb613]" />
                                        Assign Students
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-1">Select students to enroll in this class</p>
                                </div>

                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
                                    <input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 focus:ring-1 focus:ring-[#ecb613]/50 outline-none"
                                        placeholder="Filter students..."
                                        type="text"
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-2 max-h-[400px] pr-2 custom-scrollbar">
                                    {filteredStudents.map((student) => {
                                        const isSelected = selectedStudents.includes(student.id);
                                        return (
                                            <div
                                                key={student.id}
                                                onClick={() => toggleStudent(student.id)}
                                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all group ${isSelected ? 'border-[#ecb613] bg-[#ecb613]/5' : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                            >
                                                <div className={`size-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-[#ecb613] border-[#ecb613]' : 'border-slate-300 dark:border-slate-600'}`}>
                                                    {isSelected && <CheckCircle2 className="size-3 text-white" />}
                                                </div>
                                                {student.profile_pic_url ? (
                                                    <img src={student.profile_pic_url} alt={student.name} className="size-8 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                                                ) : (
                                                    <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                        {student.name.charAt(0)}
                                                    </div>
                                                )}
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-bold truncate">{student.name}</span>
                                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">{student.level}</span>
                                                </div>
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
                                    <div className="flex justify-between items-center text-xs font-bold">
                                        <span className="text-slate-500">Total Selected:</span>
                                        <span className="text-[#ecb613]">{selectedStudents.length} Students</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
