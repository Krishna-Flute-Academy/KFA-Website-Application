'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth } from '../../../../../src/lib/supabase-auth';
import { Loader2, Save, ArrowLeft } from 'lucide-react';
import TeacherSidebar from '../../../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../../../src/components/TeacherHeader';
import Link from 'next/link';
import { sortClassroomsByDayAndTime } from '../../../../../src/lib/classroomSort';
import ImageUploadWithCrop from '../../../../../src/components/teacher-dashboard/ImageUploadWithCrop';

interface Classroom {
    id: string;
    name: string;
    teacher_id?: string | null;
}

export default function EditStudentPage() {
    const router = useRouter();
    const params = useParams();
    const studentId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [teacherProfile, setTeacherProfile] = useState<{ name: string; email: string; id: string; role?: string } | null>(null);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
    const isAdmin = teacherProfile?.role === 'admin';

    // Form State
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        startDate: '',
        batchId: '',
        level: 'beginner',
        profilePicUrl: '',
        notes: '',
        status: 'active',
        feesBasis: 'monthly',
        feesAmount: '0',
        feesCollectionDate: '',
        feesClassesPaid: '0',
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

                // 2. Fetch Teacher/Admin Profile
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

                // 4. Fetch Student Data
                const { data: student, error: studentError } = await supabaseAuth
                    .from('users')
                    .select(`
                        id,
                        name,
                        email,
                        phone,
                        status,
                        join_date,
                        level,
                        profile_pic_url,
                        notes,
                        fees_basis,
                        fees_amount,
                        fees_collection_date,
                        fees_classes_paid,
                        teacher_id,
                        classroom_students(classroom_id)
                    `)
                    .eq('id', studentId)
                    .single();
 
                if (studentError || !student) {
                    console.error('Error fetching student:', studentError);
                    alert('Student not found.');
                    router.push('/teacher-dashboard/students');
                    return;
                }

                // Authorization check for teachers
                if (profile && profile.role !== 'admin' && student.teacher_id !== profile.id) {
                    alert('You are not authorized to edit this student profile.');
                    router.push('/teacher-dashboard/students');
                    return;
                }

                let baseCollectionDateStr = '';
                if (student.fees_collection_date !== null && student.fees_collection_date !== undefined) {
                    baseCollectionDateStr = String(student.fees_collection_date);
                } else if (student.join_date) {
                    baseCollectionDateStr = String(Number(student.join_date.split('T')[0].split('-')[2]));
                }

                setFormData({
                    fullName: student.name || '',
                    email: student.email || '',
                    phone: student.phone || '',
                    startDate: student.join_date ? student.join_date.split('T')[0] : '',
                    batchId: student.classroom_students?.[0]?.classroom_id || '',
                    level: student.level || 'beginner',
                    profilePicUrl: student.profile_pic_url || '',
                    notes: student.notes || '',
                    status: student.status || 'active',
                    feesBasis: student.fees_basis || 'monthly',
                    feesAmount: String(student.fees_amount || 0),
                    feesCollectionDate: baseCollectionDateStr,
                    feesClassesPaid: String(student.fees_classes_paid || 0),
                    teacherId: student.teacher_id || ''
                });

            } catch (err) {
                console.error('Error fetching initial data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [studentId, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teacherProfile) return;

        const isAdmin = teacherProfile.role === 'admin';
        setSubmitting(true);
        try {
            const finalCollectionDate = formData.feesCollectionDate ? Number(formData.feesCollectionDate) : null;

            // Step 1: Update user in public.users
            const updatePayload: any = {
                name: formData.fullName,
                email: formData.email,
                phone: formData.phone,
                status: (formData.status === 'archived' || formData.status === 'inactive') ? 'inactive' : formData.status,
                join_date: formData.startDate,
                level: formData.level,
                profile_pic_url: formData.profilePicUrl,
                notes: formData.notes
            };

            if (isAdmin) {
                updatePayload.fees_basis = formData.feesBasis;
                updatePayload.fees_amount = Number(formData.feesAmount) || 0;
                updatePayload.fees_collection_date = finalCollectionDate;
                updatePayload.fees_classes_paid = Number(formData.feesClassesPaid) || 0;
                updatePayload.teacher_id = formData.teacherId || null;
            }

            const { error: userError } = await supabaseAuth
                .from('users')
                .update(updatePayload)
                .eq('id', studentId);

            if (userError) throw userError;

            if (isAdmin) {
                // Step 2: Handle Batch Re-assignment
                let targetBatchId = formData.batchId;

                if (formData.status === 'archived' || formData.status === 'inactive') {
                    const circleRoom = classrooms.find(r => r.name.toLowerCase().includes('learning circle'));
                    if (circleRoom) {
                        targetBatchId = circleRoom.id;
                    } else {
                        const { data: circleDbRoom } = await supabaseAuth
                            .from('classrooms')
                            .select('id')
                            .ilike('name', '%Learning Circle%')
                            .maybeSingle();
                        if (circleDbRoom) {
                            targetBatchId = circleDbRoom.id;
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
                            if (newRoom) targetBatchId = newRoom.id;
                        }
                    }
                }

                // First, remove existing assignments (Simple approach for 1 batch per student)
                await supabaseAuth
                    .from('classroom_students')
                    .delete()
                    .eq('student_id', studentId);

                if (targetBatchId) {
                    const { error: classroomError } = await supabaseAuth
                        .from('classroom_students')
                        .insert([{
                            classroom_id: targetBatchId,
                            student_id: studentId,
                            joined_at: new Date().toISOString()
                        }]);

                    if (classroomError) console.error('Error linking to batch:', classroomError);
                }
            }

            // Success!
            router.push(`/teacher-dashboard/students/${studentId}`);

        } catch (err: any) {
            console.error('Error updating student:', err);
            alert(`Error: ${err.message || 'Something went wrong.'}`);
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
                <p className="font-medium text-slate-600 tracking-wide uppercase text-xs">Loading Profile...</p>
            </div>
        );
    }

    return (
        <div className="bg-[#f8fafc] text-slate-900 font-sans min-h-screen antialiased">
            <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
                <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

                <main className="flex-1 flex flex-col min-w-0">
                    <TeacherHeader title="Edit Student Profile" />

                    <div className="flex-1 overflow-y-auto p-12">
                        <div className="max-w-4xl mx-auto">
                            <div className="mb-10 flex items-end justify-between">
                                <div>
                                    <nav className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                                        <Link href="/teacher-dashboard/students" className="hover:text-[#ecb613] transition-colors">Students</Link>
                                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                        <Link href={`/teacher-dashboard/students/${studentId}`} className="hover:text-[#ecb613] transition-colors">Profile</Link>
                                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                        <span className="text-slate-600 font-medium tracking-tight">Edit</span>
                                    </nav>
                                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">Edit Profile</h2>
                                    <p className="text-slate-500 mt-2.5">Update {formData.fullName}'s information and settings.</p>
                                </div>
                                <Link
                                    href={`/teacher-dashboard/students/${studentId}`}
                                    className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#ecb613] transition-all bg-white border border-slate-200 px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md"
                                >
                                    <ArrowLeft size={18} strokeWidth={2.5} />
                                    Back to Profile
                                </Link>
                            </div>
<div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="h-1.5 w-full bg-[#ecb613]"></div>
                                <form className="p-10" onSubmit={handleSubmit}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-sm font-bold text-slate-700 block">Profile Picture</label>
                                            <ImageUploadWithCrop
                                                value={formData.profilePicUrl}
                                                onChange={(url) => setFormData({ ...formData, profilePicUrl: url })}
                                                studentId={studentId}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 block">Full Name</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                                value={formData.fullName}
                                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 block">Status</label>
                                            <div className="relative">
                                                <select
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none appearance-none font-bold"
                                                    value={formData.status}
                                                    onChange={(e) => {
                                                        const newStatus = e.target.value;
                                                        if (newStatus === 'archived' || newStatus === 'inactive') {
                                                            const circleRoom = classrooms.find(r => r.name.toLowerCase().includes('learning circle'));
                                                            setFormData({
                                                                ...formData,
                                                                status: newStatus,
                                                                batchId: circleRoom ? circleRoom.id : formData.batchId
                                                            });
                                                        } else {
                                                            setFormData({ ...formData, status: newStatus });
                                                        }
                                                    }}
                                                >
                                                    <option value="active">Active</option>
                                                    <option value="inactive">Inactive</option>
                                                    <option value="archived">Archived</option>
                                                </select>
                                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 block">Email Address</label>
                                            <input
                                                required
                                                type="email"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 block">Phone Number</label>
                                            <input
                                                type="tel"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            />
                                        </div>
                                        
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
                                            <label className="text-sm font-bold text-slate-700 block">Batch Assignment</label>
                                            <div className="relative">
                                                <select
                                                    disabled={!isAdmin}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                                                    value={formData.batchId}
                                                    onChange={(e) => {
                                                        const newBatchId = e.target.value;
                                                        const room = classrooms.find(r => r.id === newBatchId);
                                                        setFormData({ 
                                                            ...formData, 
                                                            batchId: newBatchId,
                                                            teacherId: room?.teacher_id || formData.teacherId
                                                        });
                                                    }}
                                                >
                                                    <option value="">Unassigned</option>
                                                    {sortClassroomsByDayAndTime(classrooms).map(room => (
                                                        <option key={room.id} value={room.id}>{room.name}</option>
                                                    ))}
                                                </select>
                                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                            </div>
                                        </div>
                                        {isAdmin && (
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
                                            <label className="text-sm font-bold text-slate-700 block">Join Date</label>
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
                                        {/* Fees Configuration */}
                                        {isAdmin && (
                                            <>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-slate-700 block">Fees Payment Basis</label>
                                                    <div className="relative">
                                                        <select
                                                            disabled={!isAdmin}
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                                                            value={formData.feesBasis}
                                                            onChange={(e) => setFormData({ ...formData, feesBasis: e.target.value })}
                                                        >
                                                            <option value="monthly">Monthly Subscription (4 classes)</option>
                                                            <option value="class">Class-basis (Advance Booking)</option>
                                                        </select>
                                                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-slate-700 block">Fees Amount</label>
                                                    <input
                                                        required
                                                        disabled={!isAdmin}
                                                        type="number"
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                                                        placeholder="e.g. 2000"
                                                        value={formData.feesAmount}
                                                        onChange={(e) => setFormData({ ...formData, feesAmount: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-slate-700 block">Fees Collection Date (Day of Month)</label>
                                                    <div className="relative">
                                                        <select
                                                            disabled={!isAdmin}
                                                            required
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none appearance-none disabled:opacity-60 disabled:cursor-not-allowed font-bold"
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
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-slate-700 block">Prepaid Classes Balance</label>
                                                    <input
                                                        required
                                                        disabled={!isAdmin}
                                                        type="number"
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                                                        placeholder="e.g. 4"
                                                        value={formData.feesClassesPaid}
                                                        onChange={(e) => setFormData({ ...formData, feesClassesPaid: e.target.value })}
                                                    />
                                                </div>
                                            </>
                                        )}
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-sm font-bold text-slate-700 block">Additional Notes</label>
                                            <textarea
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none min-h-[120px] resize-none"
                                                value={formData.notes}
                                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            ></textarea>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end border-t border-slate-100 pt-8 gap-4">
                                        <button
                                            type="button"
                                            className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                                            onClick={() => router.back()}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="bg-[#ecb613] hover:bg-[#ecb613]/90 text-white px-10 py-3 rounded-xl text-sm font-bold shadow-lg shadow-[#ecb613]/25 transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-70"
                                        >
                                            {submitting ? (
                                                <><Loader2 className="animate-spin size-4" /> Saving...</>
                                            ) : (
                                                <><Save size={18} /> Save Changes</>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
