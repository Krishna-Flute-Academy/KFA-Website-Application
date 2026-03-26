'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../../src/lib/supabase-auth';
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
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        type: 'permanent',
        selectedDays: [] as number[], // 0=Sun, 1=Mon, ..., 6=Sat
        startTime: '07:00',
        endTime: '08:00'
    });

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

                // 2. Fetch Teacher Profile
                const { data: profile } = await supabaseAuth
                    .from('users')
                    .select('id, name, email')
                    .eq('id', session.user.id)
                    .single();
                setTeacherProfile(profile);

                if (!profile) return;

                // 3. Fetch Students directly from users table
                const { data: studentsData, error: studentsError } = await supabaseAuth
                    .from('users')
                    .select(`
                        id,
                        name,
                        level,
                        profile_pic_url
                    `)
                    .eq('role', 'student')
                    .eq('teacher_id', profile.id);

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

    const handleCreateClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teacherProfile) return;
        if (!formData.name) {
            alert('Please enter a class name.');
            return;
        }

        setSubmitting(true);
        try {
            // Build schedule text for display
            const scheduleText = formData.selectedDays.length > 0
                ? formData.selectedDays.map(d => DAY_LABELS[d]).join(', ') + ` • ${formData.startTime}`
                : `${formData.startTime}`;

            // 1. Create Classroom
            const { data: classroom, error: classroomError } = await supabaseAuth
                .from('classrooms')
                .insert([{
                    teacher_id: teacherProfile.id,
                    name: formData.name,
                    description: formData.description,
                    schedule: scheduleText
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

            alert('Class created successfully!');
            router.push('/teacher-dashboard/classrooms');

        } catch (err) {
            console.error('Error creating class:', err);
            alert('Failed to create class. Please try again.');
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
                <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
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
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Start Time</label>
                                            <div className="relative">
                                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                                                <input
                                                    value={formData.startTime}
                                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613]/50 focus:border-[#ecb613] outline-none transition-all"
                                                    type="time"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">End Time</label>
                                            <div className="relative">
                                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                                                <input
                                                    value={formData.endTime}
                                                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#ecb613]/50 focus:border-[#ecb613] outline-none transition-all"
                                                    type="time"
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
