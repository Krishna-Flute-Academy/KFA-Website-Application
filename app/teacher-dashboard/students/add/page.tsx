'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../../src/lib/supabase-auth';
import { Loader2, Plus, ArrowLeft } from 'lucide-react';
import TeacherSidebar from '../../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../../src/components/TeacherHeader';
import Link from 'next/link';
import ImageUploadWithCrop from '../../../../src/components/teacher-dashboard/ImageUploadWithCrop';
import { sortClassroomsByDayAndTime } from '../../../../src/lib/classroomSort';

interface Classroom {
    id: string;
    name: string;
}

function generateUUID() {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export default function AddStudentPage() {
    const router = useRouter();
    const [studentId] = useState(() => generateUUID());
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [teacherProfile, setTeacherProfile] = useState<{ name: string; email: string; id: string; role?: string } | null>(null);
    const [classrooms, setClassrooms] = useState<(Classroom & { teacher_id?: string })[]>([]);
    const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        startDate: new Date().toISOString().split('T')[0],
        batchId: '',
        level: 'beginner',
        learningMode: 'online',
        profilePicUrl: '',
        notes: '',
        feesBasis: 'monthly',
        feesAmount: '0',
        feesCollectionDate: String(new Date().getDate()),
        feesClassesPaid: '4',
        teacherId: ''
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                // 1. Check Session
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                const userId = session.user.id;

                // 2. Fetch User Profile
                const { data: profile } = await supabaseAuth
                    .from('users')
                    .select('id, name, email, role')
                    .eq('id', userId)
                    .single();

                if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
                    router.push('/');
                    return;
                }
                setTeacherProfile({ id: profile.id, name: profile.name, email: profile.email, role: profile.role });

                // 3. Fetch Classrooms
                const roomsQuery = supabaseAuth
                    .from('classrooms')
                    .select('id, name, teacher_id');

                const { data: rooms } = profile.role === 'admin'
                    ? await roomsQuery
                    : await roomsQuery.eq('teacher_id', userId);

                if (rooms) {
                    setClassrooms(rooms);
                }

                if (profile.role === 'admin') {
                    const { data: teachersData } = await supabaseAuth
                        .from('users')
                        .select('id, name')
                        .in('role', ['teacher', 'admin']);
                    if (teachersData) {
                        setTeachers(teachersData);
                    }
                }

            } catch (err) {
                console.error('Error fetching initial data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teacherProfile) return;

        setSubmitting(true);
        try {
            // Save the Fees Collection Date as day of the month (1-31) for monthly basis, or null for class basis
            const finalCollectionDate = (formData.feesBasis === 'monthly' && formData.feesCollectionDate) ? Number(formData.feesCollectionDate) : null;

            const selectedClassroom = classrooms.find(r => r.id === formData.batchId);
            const assignedTeacherId = teacherProfile.role === 'admin'
                ? (formData.teacherId || selectedClassroom?.teacher_id || null)
                : teacherProfile.id;

            // Step 1: Create user in public.users with all student details
            // Level, Notes, Join Date, and Teacher ID are now directly in public.users
            const { data: userData, error: userError } = await supabaseAuth
                .from('users')
                .insert([{
                    id: studentId,
                    name: formData.fullName,
                    email: formData.email,
                    phone: formData.phone,
                    role: 'student',
                    status: 'active',
                    teacher_id: assignedTeacherId,
                    join_date: formData.startDate,
                    level: formData.level,
                    learning_mode: formData.learningMode,
                    profile_pic_url: formData.profilePicUrl,
                    notes: formData.notes,
                    fees_basis: formData.feesBasis,
                    fees_amount: Number(formData.feesAmount) || 0,
                    fees_collection_date: finalCollectionDate,
                    fees_classes_paid: Number(formData.feesClassesPaid) || 0
                }])
                .select()
                .single();

            if (userError) throw userError;

            // Step 2: Link to Classroom (Batch)
            if (formData.batchId && userData) {
                const { error: classroomError } = await supabaseAuth
                    .from('classroom_students')
                    .insert([{
                        classroom_id: formData.batchId,
                        student_id: userData.id, // Direct link to users.id
                        joined_at: new Date().toISOString()
                    }]);

                if (classroomError) console.error('Error linking to batch:', classroomError);
            }

            // Success!
            router.push('/teacher-dashboard/students');

        } catch (err: any) {
            console.error('Error adding student:', err);
            alert(`Error: ${err.message || 'Something went wrong while adding the student.'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600">Preparing enrollment form...</p>
            </div>
        );
    }

    return (
        <div className="bg-[#f8fafc] text-slate-900 font-sans min-h-screen antialiased">
            <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

                <main className="flex-1 flex flex-col min-w-0">
                    <TeacherHeader title="Add Student" />

                    <div className="flex-1 overflow-y-auto p-12">
                        <div className="max-w-4xl mx-auto">
                            <div className="mb-10 flex items-end justify-between">
                                <div>
                                    <nav className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                                        <Link href="/teacher-dashboard/students" className="hover:text-[#ecb613] transition-colors">Students</Link>
                                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                        <span className="text-slate-600 font-medium tracking-tight">Add New Student</span>
                                    </nav>
                                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">Register New Student</h2>
                                    <p className="text-slate-500 mt-2.5">Complete the enrollment form to create a new student profile.</p>
                                </div>
                                <Link
                                    href="/teacher-dashboard/students"
                                    className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#ecb613] transition-all bg-white border border-slate-200 px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md"
                                >
                                    <ArrowLeft size={18} strokeWidth={2.5} />
                                    Return to List
                                </Link>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="h-1.5 w-full bg-[#f5f0e1]"></div>
                                <form className="p-10" onSubmit={handleSubmit}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 block">Full Name</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                                placeholder="e.g. Aarav Patel"
                                                value={formData.fullName}
                                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 block">Email Address</label>
                                            <input
                                                required
                                                type="email"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                                placeholder="aarav@email.com"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 block">Phone Number</label>
                                            <input
                                                type="tel"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                                placeholder="+91 98XXX XXXXX"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 block">Start Date</label>
                                            <input
                                                required
                                                type="date"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                                value={formData.startDate}
                                                onChange={(e) => {
                                                    const newDate = e.target.value;
                                                    const day = newDate ? String(Number(newDate.split('-')[2])) : '';
                                                    setFormData({
                                                        ...formData,
                                                        startDate: newDate,
                                                        feesCollectionDate: day
                                                    });
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 block">Batch Assignment</label>
                                            <div className="relative">
                                                <select
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none appearance-none"
                                                    value={formData.batchId}
                                                    onChange={(e) => {
                                                        const newBatchId = e.target.value;
                                                        const room = classrooms.find(r => r.id === newBatchId);
                                                        const isOfflineRoom = room?.name.toLowerCase().includes('offline');
                                                        setFormData({ 
                                                            ...formData, 
                                                            batchId: newBatchId,
                                                            learningMode: isOfflineRoom ? 'offline' : 'online',
                                                            teacherId: room?.teacher_id || formData.teacherId
                                                        });
                                                    }}
                                                >
                                                    <option value="" disabled>Select an active batch...</option>
                                                    {sortClassroomsByDayAndTime(classrooms).map(room => (
                                                        <option key={room.id} value={room.id}>{room.name}</option>
                                                    ))}
                                                </select>
                                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                            </div>
                                        </div>

                                        {teacherProfile?.role === 'admin' && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-bold text-slate-700 block">Teacher Assignment</label>
                                                <div className="relative">
                                                    <select
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none appearance-none font-bold"
                                                        value={formData.teacherId}
                                                        onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {teachers.map(teacher => (
                                                            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                                                        ))}
                                                    </select>
                                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 block">Experience Level</label>
                                            <div className="relative">
                                                <select
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none appearance-none"
                                                    value={formData.level}
                                                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                                                >
                                                    <option value="beginner">Beginner</option>
                                                    <option value="intermediate">Intermediate</option>
                                                    <option value="advanced">Advanced</option>
                                                </select>
                                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 block">Class Learning Mode</label>
                                            <div className="relative">
                                                <select
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none appearance-none font-bold"
                                                    value={formData.learningMode}
                                                    onChange={(e) => setFormData({ ...formData, learningMode: e.target.value })}
                                                >
                                                    <option value="online">Online (Live Virtual Class)</option>
                                                    <option value="offline">Offline (In-Person Classroom)</option>
                                                </select>
                                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                            </div>
                                        </div>
                                        {/* Fees Configuration */}
                                        {teacherProfile?.role === 'admin' && (
                                            <>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-slate-700 block">Fees Payment Basis</label>
                                                    <div className="relative">
                                                        <select
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none appearance-none"
                                                            value={formData.feesBasis}
                                                            onChange={(e) => {
                                                                const basis = e.target.value;
                                                                setFormData({
                                                                    ...formData,
                                                                    feesBasis: basis,
                                                                    feesClassesPaid: basis === 'class' ? '1' : '4',
                                                                    feesCollectionDate: basis === 'class' ? '' : (formData.feesCollectionDate || String(new Date().getDate()))
                                                                });
                                                            }}
                                                        >
                                                            <option value="monthly">Monthly Subscription (4 classes / month)</option>
                                                            <option value="class">Class-basis (Pay Per Class / 1 class)</option>
                                                        </select>
                                                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-slate-700 block">
                                                        {formData.feesBasis === 'class' ? 'Fee Per Class (₹)' : 'Monthly Fees Amount (₹)'}
                                                    </label>
                                                    <input
                                                        required
                                                        type="number"
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                                        placeholder={formData.feesBasis === 'class' ? "e.g. 500 per class" : "e.g. 2000 per month"}
                                                        value={formData.feesAmount}
                                                        onChange={(e) => setFormData({ ...formData, feesAmount: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-slate-700 block">Fees Collection Date (Day of Month)</label>
                                                    {formData.feesBasis === 'class' ? (
                                                        <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold text-slate-400 italic">
                                                            N/A — Collection day is not applicable for Class-basis students.
                                                        </div>
                                                    ) : (
                                                        <div className="relative">
                                                            <select
                                                                required={formData.feesBasis === 'monthly'}
                                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none appearance-none font-bold"
                                                                value={formData.feesCollectionDate}
                                                                onChange={(e) => setFormData({ ...formData, feesCollectionDate: e.target.value })}
                                                            >
                                                                <option value="" disabled>Select day of month (1-31)...</option>
                                                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                                                    <option key={day} value={String(day)}>{day}</option>
                                                                ))}
                                                            </select>
                                                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-slate-700 block">Initial Prepaid Classes</label>
                                                    <input
                                                        required
                                                        type="number"
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                                        placeholder={formData.feesBasis === 'class' ? "e.g. 1" : "e.g. 4"}
                                                        value={formData.feesClassesPaid}
                                                        onChange={(e) => setFormData({ ...formData, feesClassesPaid: e.target.value })}
                                                    />
                                                </div>
                                            </>
                                        )}
                                                                                <div className="space-y-2 md:col-span-2">
                                            <label className="text-sm font-bold text-slate-700 block">Profile Picture</label>
                                            <ImageUploadWithCrop
                                                value={formData.profilePicUrl}
                                                onChange={(url) => setFormData({ ...formData, profilePicUrl: url })}
                                                studentId={studentId}
                                            />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-sm font-bold text-slate-700 block">Additional Notes</label>
                                            <textarea
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none min-h-[120px] resize-none"
                                                placeholder="Enter any previous musical background, medical conditions, or specific learning goals..."
                                                value={formData.notes}
                                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            ></textarea>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-slate-100 pt-8">
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input defaultChecked type="checkbox" className="size-4 rounded border-slate-300 text-[#ecb613] focus:ring-[#ecb613]/20" />
                                                <span className="text-sm text-slate-500 group-hover:text-slate-700 transition-colors">Send Welcome Kit via Email</span>
                                            </label>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <button
                                                type="button"
                                                className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                                                onClick={() => router.back()}
                                            >
                                                Discard
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="bg-[#ecb613] hover:bg-[#ecb613]/90 text-white px-10 py-3 rounded-xl text-sm font-bold shadow-lg shadow-[#ecb613]/25 transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-70"
                                            >
                                                {submitting ? (
                                                    <><Loader2 className="animate-spin size-4" /> Processing...</>
                                                ) : (
                                                    'Add Student'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="p-6 bg-white rounded-2xl border border-slate-200 flex items-start gap-4">
                                    <div className="size-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined">contact_mail</span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800">Auto-Notifications</h4>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">Parents will receive login credentials immediately after registration.</p>
                                    </div>
                                </div>
                                <div className="p-6 bg-white rounded-2xl border border-slate-200 flex items-start gap-4">
                                    <div className="size-10 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined">payments</span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800">Billing Setup</h4>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">The first invoice will be generated based on the selected batch fee.</p>
                                    </div>
                                </div>
                                <div className="p-6 bg-white rounded-2xl border border-slate-200 flex items-start gap-4">
                                    <div className="size-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined">edit_calendar</span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800">Class Scheduling</h4>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">Student will be added to the attendance roster for the current term.</p>
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
