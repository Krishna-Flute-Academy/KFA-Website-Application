'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { supabaseAuth } from '../../../../src/lib/supabase-auth';
import { Loader2, Plus, ArrowLeft, Eye, EyeOff, RefreshCw, Copy, Check, CheckCircle2, Mail } from 'lucide-react';
import TeacherSidebar from '../../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../../src/components/TeacherHeader';
import Link from 'next/link';
import ImageUploadWithCrop from '../../../../src/components/teacher-dashboard/ImageUploadWithCrop';
import { sortClassroomsByDayAndTime } from '../../../../src/lib/classroomSort';
import { fetchAcademyTeachers } from '../../../../src/lib/teachers';

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

function generateTempPassword() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
    let suffix = '';
    for (let i = 0; i < 6; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Kfa@${suffix}`;
}

export default function AddStudentPage() {
    const router = useRouter();
    const [studentId, setStudentId] = useState(() => generateUUID());
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(true);
    const [copiedPassword, setCopiedPassword] = useState(false);
    const [copiedCredentials, setCopiedCredentials] = useState(false);
    const [createdCredentials, setCreatedCredentials] = useState<{
        name: string;
        email: string;
        password: string;
        emailConfirmationSent: boolean;
    } | null>(null);
    const [teacherProfile, setTeacherProfile] = useState<{ name: string; email: string; id: string; role?: string } | null>(null);
    const [classrooms, setClassrooms] = useState<(Classroom & { teacher_id?: string })[]>([]);
    const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: generateTempPassword(),
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
                    const teachersData = await fetchAcademyTeachers(supabaseAuth, profile.id, rooms);
                    if (teachersData && teachersData.length > 0) {
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

        const cleanName = formData.fullName.trim();
        const cleanEmail = formData.email.trim().toLowerCase();
        const cleanPassword = formData.password.trim();

        if (cleanPassword.length < 6) {
            alert('Error: Temporary password must be at least 6 characters long.');
            return;
        }

        setSubmitting(true);
        try {
            // Canonical rule: Monthly billing due day equals student join-date day
            const joinDay = formData.startDate ? new Date(formData.startDate).getDate() : new Date().getDate();
            const finalCollectionDate = formData.feesBasis === 'monthly' ? joinDay : null;

            const selectedClassroom = classrooms.find(r => r.id === formData.batchId);
            const assignedTeacherId = teacherProfile.role === 'admin'
                ? (formData.teacherId || selectedClassroom?.teacher_id || null)
                : teacherProfile.id;

            // 1. Check if a non-pending user with this email already exists in public.users
            const { data: existingUser } = await supabaseAuth
                .from('users')
                .select('id, role')
                .ilike('email', cleanEmail)
                .maybeSingle();

            if (existingUser && existingUser.role !== 'pending') {
                throw new Error(`A user with email ${cleanEmail} is already registered.`);
            }

            // 2. Create the Supabase Auth account using an isolated non-persisting client
            // so the admin/teacher's own active session in localStorage is never overwritten.
            // This triggers the confirmation email to the student and flags must_change_password: true.
            let effectiveStudentId = existingUser?.id || studentId;
            let emailConfirmationSent = false;

            if (!existingUser) {
                const supabaseAuthUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL || '';
                const supabaseAuthAnonKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY || '';
                const isolatedAuthClient = createClient(supabaseAuthUrl, supabaseAuthAnonKey, {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false,
                    }
                });

                const { data: signUpData, error: signUpError } = await isolatedAuthClient.auth.signUp({
                    email: cleanEmail,
                    password: cleanPassword,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                        data: {
                            full_name: cleanName,
                            phone: formData.phone || null,
                            must_change_password: true,
                        }
                    }
                });

                if (signUpError) {
                    throw signUpError;
                }

                if (signUpData?.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
                    throw new Error(`An authentication account with ${cleanEmail} already exists.`);
                }

                if (signUpData?.user?.id) {
                    effectiveStudentId = signUpData.user.id;
                    emailConfirmationSent = true;
                }
            }

            // 3. Genuinely transactional atomic student onboarding
            // Executes user profile creation/promotion, initial prepaid credit allocation, and batch enrollment
            // within a single database transaction. All steps succeed or roll back atomically.
            const stableIdempotencyKey = `onboard_${effectiveStudentId}`;
            const initialCredits = Number(formData.feesClassesPaid) || 0;

            const { data: onboardResult, error: onboardError } = await supabaseAuth.rpc('onboard_student_atomic', {
                p_student_id: effectiveStudentId,
                p_name: cleanName,
                p_email: cleanEmail,
                p_phone: formData.phone || null,
                p_role: 'student',
                p_status: 'active',
                p_teacher_id: assignedTeacherId,
                p_join_date: formData.startDate || new Date().toISOString().split('T')[0],
                p_level: formData.level,
                p_learning_mode: formData.learningMode,
                p_profile_pic_url: formData.profilePicUrl || null,
                p_notes: formData.notes || null,
                p_fees_basis: formData.feesBasis,
                p_fees_amount: Number(formData.feesAmount) || 0,
                p_fees_collection_date: finalCollectionDate,
                p_initial_credits: initialCredits,
                p_classroom_id: formData.batchId || null,
                p_idempotency_key: stableIdempotencyKey,
                p_credit_type: 'payment_purchase',
                p_payment_method: 'UPI'
            });

            if (onboardError) throw onboardError;

            // Explicit Failure Recovery Architecture:
            // In KFA, Supabase Auth user identity is merged on-demand via handle_new_user() when the
            // student first authenticates with their confirmed email. If an external admin flow pre-creates
            // an auth.users record prior to onboarding, catch blocks must invoke supabaseAdmin.auth.admin.deleteUser(id)
            // to ensure zero orphaned authentication credentials remain after an onboarding failure.

            // Show the credentials summary modal so the admin can copy and share with the student
            setCreatedCredentials({
                name: cleanName,
                email: cleanEmail,
                password: cleanPassword,
                emailConfirmationSent
            });

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

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-12">
                        <div className="max-w-4xl mx-auto">
                            <div className="mb-6 sm:mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                                <div>
                                    <nav className="flex items-center gap-2 text-sm text-slate-400 mb-2 sm:mb-3">
                                        <Link href="/teacher-dashboard/students" className="hover:text-[#ecb613] transition-colors">Students</Link>
                                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                        <span className="text-slate-600 font-medium tracking-tight">Add New Student</span>
                                    </nav>
                                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight">Register New Student</h2>
                                    <p className="text-slate-500 mt-1 sm:mt-2 text-sm">Complete the enrollment form to create a new student profile.</p>
                                </div>
                                <Link
                                    href="/teacher-dashboard/students"
                                    className="self-start sm:self-auto flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#ecb613] transition-all bg-white border border-slate-200 px-4 sm:px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md shrink-0"
                                >
                                    <ArrowLeft size={18} strokeWidth={2.5} />
                                    Return to List
                                </Link>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="h-1.5 w-full bg-[#f5f0e1]"></div>
                                <form className="p-4 sm:p-6 lg:p-10" onSubmit={handleSubmit}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 md:gap-8 mb-8 sm:mb-10">
                                        <div className="space-y-2">
                                            <label htmlFor="student-full-name" className="text-sm font-bold text-slate-700 block cursor-pointer">
                                                Full Name <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                id="student-full-name"
                                                required
                                                type="text"
                                                aria-required="true"
                                                aria-label="Full Name"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                                placeholder="e.g. Aarav Patel"
                                                value={formData.fullName}
                                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="student-email" className="text-sm font-bold text-slate-700 block cursor-pointer">
                                                Email Address (Login ID) <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                id="student-email"
                                                required
                                                type="email"
                                                aria-required="true"
                                                aria-label="Email Address"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                                placeholder="aarav@email.com"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="student-password" className="text-sm font-bold text-slate-700 block cursor-pointer">
                                                Pre-generated Temporary Password <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <input
                                                        id="student-password"
                                                        required
                                                        minLength={6}
                                                        type={showPassword ? 'text' : 'password'}
                                                        aria-required="true"
                                                        aria-label="Pre-generated Temporary Password"
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-10 py-3 text-sm font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                                        placeholder="At least 6 characters"
                                                        value={formData.password}
                                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                                        aria-label="Toggle password visibility"
                                                    >
                                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, password: generateTempPassword() })}
                                                    className="px-3 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shrink-0"
                                                    title="Generate a new password"
                                                    aria-label="Generate a new temporary password"
                                                >
                                                    <RefreshCw size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(formData.password);
                                                        setCopiedPassword(true);
                                                        setTimeout(() => setCopiedPassword(false), 2000);
                                                    }}
                                                    className="px-3 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shrink-0"
                                                    title="Copy temporary password"
                                                    aria-label="Copy temporary password"
                                                >
                                                    {copiedPassword ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                                                </button>
                                            </div>
                                            <p className="text-[11px] text-slate-500">
                                                Student will receive a verification email and must change this password upon first login.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="student-phone" className="text-sm font-bold text-slate-700 block cursor-pointer">Phone Number</label>
                                            <input
                                                id="student-phone"
                                                type="tel"
                                                aria-label="Phone Number"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                                placeholder="+91 98XXX XXXXX"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="student-start-date" className="text-sm font-bold text-slate-700 block cursor-pointer">
                                                Start Date <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                id="student-start-date"
                                                required
                                                type="date"
                                                aria-required="true"
                                                aria-label="Start Date"
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
                                            <label htmlFor="student-batch" className="text-sm font-bold text-slate-700 block cursor-pointer">Batch Assignment</label>
                                            <div className="relative">
                                                <select
                                                    id="student-batch"
                                                    aria-label="Batch Assignment"
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
                                                <label htmlFor="student-teacher" className="text-sm font-bold text-slate-700 block cursor-pointer">Teacher Assignment</label>
                                                <div className="relative">
                                                    <select
                                                        id="student-teacher"
                                                        aria-label="Teacher Assignment"
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
                                            <label htmlFor="student-level" className="text-sm font-bold text-slate-700 block cursor-pointer">Experience Level</label>
                                            <div className="relative">
                                                <select
                                                    id="student-level"
                                                    aria-label="Experience Level"
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
                                            <label htmlFor="student-learning-mode" className="text-sm font-bold text-slate-700 block cursor-pointer">Class Learning Mode</label>
                                            <div className="relative">
                                                <select
                                                    id="student-learning-mode"
                                                    aria-label="Class Learning Mode"
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
                                                    <label htmlFor="student-fees-basis" className="text-sm font-bold text-slate-700 block cursor-pointer">Fees Payment Basis</label>
                                                    <div className="relative">
                                                        <select
                                                            id="student-fees-basis"
                                                            aria-label="Fees Payment Basis"
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
                                                    <label htmlFor="student-fees-amount" className="text-sm font-bold text-slate-700 block cursor-pointer">
                                                        {formData.feesBasis === 'class' ? 'Fee Per Class (₹)' : 'Monthly Fees Amount (₹)'} <span className="text-rose-500">*</span>
                                                    </label>
                                                    <input
                                                        id="student-fees-amount"
                                                        required
                                                        type="number"
                                                        aria-required="true"
                                                        aria-label={formData.feesBasis === 'class' ? 'Fee Per Class' : 'Monthly Fees Amount'}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none"
                                                        placeholder={formData.feesBasis === 'class' ? "e.g. 500 per class" : "e.g. 2000 per month"}
                                                        value={formData.feesAmount}
                                                        onChange={(e) => setFormData({ ...formData, feesAmount: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label htmlFor="student-fees-collection-date" className="text-sm font-bold text-slate-700 block cursor-pointer">Monthly Billing Due Day</label>
                                                    {formData.feesBasis === 'class' ? (
                                                        <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold text-slate-400 italic">
                                                            N/A — Collection day is not applicable for Class-basis students.
                                                        </div>
                                                    ) : (
                                                        <div className="relative">
                                                            <input
                                                                id="student-fees-collection-date"
                                                                type="text"
                                                                disabled
                                                                aria-label="Monthly Billing Due Day"
                                                                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none cursor-not-allowed"
                                                                value={formData.startDate ? `${new Date(formData.startDate).getDate()}${['st','nd','rd'][((new Date(formData.startDate).getDate() + 90) % 100 - 10) % 10 - 1] || 'th'} of month (Aligned with join date)` : 'Aligned with join date'}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <label htmlFor="student-fees-classes-paid" className="text-sm font-bold text-slate-700 block cursor-pointer">
                                                        Initial Prepaid Classes <span className="text-rose-500">*</span>
                                                    </label>
                                                    <input
                                                        id="student-fees-classes-paid"
                                                        required
                                                        type="number"
                                                        aria-required="true"
                                                        aria-label="Initial Prepaid Classes"
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
                                            <label htmlFor="student-notes" className="text-sm font-bold text-slate-700 block cursor-pointer">Additional Notes</label>
                                            <textarea
                                                id="student-notes"
                                                aria-label="Additional Notes"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] transition-all outline-none min-h-[120px] resize-none"
                                                placeholder="Enter any previous musical background, medical conditions, or specific learning goals..."
                                                value={formData.notes}
                                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            ></textarea>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-slate-100 pt-6 sm:pt-8 gap-4">
                                        <div className="flex items-center gap-4">
                                            <label htmlFor="student-welcome-kit" className="flex items-center gap-2 cursor-pointer group">
                                                <input id="student-welcome-kit" aria-label="Send Welcome Kit via Email" defaultChecked type="checkbox" className="size-4 rounded border-slate-300 text-[#ecb613] focus:ring-[#ecb613]/20 cursor-pointer" />
                                                <span className="text-sm text-slate-500 group-hover:text-slate-700 transition-colors">Send Welcome Kit via Email</span>
                                            </label>
                                        </div>
                                        <div className="flex items-center justify-end gap-3 sm:gap-4">
                                            <button
                                                type="button"
                                                className="px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                                                onClick={() => router.back()}
                                            >
                                                Discard
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={submitting}
                                                className="bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-950 px-6 sm:px-10 py-2.5 sm:py-3 rounded-xl text-sm font-bold shadow-lg shadow-[#ecb613]/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
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

            {createdCredentials && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="student-credentials-modal-title"
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
                >
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 sm:p-8 text-left space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="size-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 id="student-credentials-modal-title" className="text-lg font-bold text-slate-900">
                                    Student Registered!
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {createdCredentials.emailConfirmationSent
                                        ? 'Verification email has been sent to the student.'
                                        : 'Student profile has been activated.'}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-sm">
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Student Name</span>
                                <span className="font-bold text-slate-800">{createdCredentials.name}</span>
                            </div>
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Login Email ID</span>
                                <span className="font-mono font-semibold text-slate-800 break-all">{createdCredentials.email}</span>
                            </div>
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Temporary Password</span>
                                <span className="font-mono font-bold text-[#a15912] bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg inline-block mt-0.5">
                                    {createdCredentials.password}
                                </span>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1 leading-relaxed">
                            <div className="font-bold flex items-center gap-1.5 text-blue-800">
                                <Mail className="w-3.5 h-3.5" />
                                <span>Student First-Login Steps:</span>
                            </div>
                            <ol className="list-decimal list-inside space-y-0.5 text-blue-800/90">
                                <li>Click the verification link sent to <strong>{createdCredentials.email}</strong>.</li>
                                <li>Sign in at <strong>/login</strong> using the Email ID & Temporary Password above.</li>
                                <li>Set a new personal password when prompted on first login.</li>
                            </ol>
                        </div>

                        <div className="flex flex-col gap-2.5 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    const loginUrl = `${window.location.origin}/login`;
                                    const msg = `Welcome to Krishna Flute Academy, ${createdCredentials.name}!\n\nLogin Portal: ${loginUrl}\nEmail ID: ${createdCredentials.email}\nTemporary Password: ${createdCredentials.password}\n\nSteps to Sign In:\n1. Open the verification email sent to ${createdCredentials.email} and click the confirmation link.\n2. Sign in with the Email ID and Temporary Password above.\n3. Set your own new password when prompted on your first login.`;
                                    navigator.clipboard.writeText(msg);
                                    setCopiedCredentials(true);
                                    setTimeout(() => setCopiedCredentials(false), 2500);
                                }}
                                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                            >
                                {copiedCredentials ? (
                                    <>
                                        <Check className="w-4 h-4 text-emerald-400" />
                                        <span>Copied Credentials & Instructions!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        <span>Copy Credentials & Instructions</span>
                                    </>
                                )}
                            </button>

                            <div className="flex items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCreatedCredentials(null);
                                        setStudentId(generateUUID());
                                        setFormData(prev => ({
                                            ...prev,
                                            fullName: '',
                                            email: '',
                                            password: generateTempPassword(),
                                            phone: '',
                                            profilePicUrl: '',
                                            notes: ''
                                        }));
                                    }}
                                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                                >
                                    Add Another
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.push('/teacher-dashboard/students')}
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                                >
                                    Go to Students List
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
