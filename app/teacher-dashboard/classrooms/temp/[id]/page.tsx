'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth } from '../../../../../src/lib/supabase-auth';
import { Loader2 as Spinner, ArrowLeft as Back, Clock as Time, Users as Group, Search as Find, Save as Done, CheckCircle as Check, Circle as Empty, UserPlus as AddUser, Trash2 as Delete } from 'lucide-react';
import Link from 'next/link';
import TeacherSidebar from '../../../../../src/components/TeacherSidebar';

// Reuse the time formatting and options
function formatTime12hr(time24: string) {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hStr = hours.toString().padStart(2, '0');
    return `${hStr}:${m} ${ampm}`;
}

const generateTimeOptions = () => {
    const options = [];
    for (let h = 5; h <= 23; h++) {
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

interface TempClass {
    id: string;
    classroom_id: string;
    title: string;
    class_date: string;
    start_time: string;
    end_time: string;
}

interface Student {
    id: string;
    name: string;
    profile_pic_url: string | null;
}

export default function TempClassManagePage() {
    const router = useRouter();
    const params = useParams();
    const classId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [teacherProfile, setTeacherProfile] = useState<any>(null);
    const [tempClass, setTempClass] = useState<TempClass | null>(null);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Form state
    const [startTime, setStartTime] = useState('10:00');
    const [endTime, setEndTime] = useState('11:00');

    useEffect(() => {
        const fetchData = async () => {
            if (!classId) return;
            setLoading(true);
            try {
                const { data: { session } } = await supabaseAuth.auth.getSession();
                if (!session) {
                    router.push('/login?type=teacher');
                    return;
                }

                const { data: profile } = await supabaseAuth
                    .from('users')
                    .select('id, name, email')
                    .eq('id', session.user.id)
                    .single();
                setTeacherProfile(profile);

                if (!profile) return;

                // 1. Fetch Class Data
                const { data: roomData, error: roomError } = await supabaseAuth
                    .from('temporary_classes')
                    .select('*')
                    .eq('id', classId)
                    .eq('teacher_id', profile.id)
                    .single();
                
                if (roomError) throw roomError;
                setTempClass(roomData);
                setStartTime(roomData?.start_time ? roomData.start_time.slice(0, 5) : '10:00');
                setEndTime(roomData?.end_time ? roomData.end_time.slice(0, 5) : '11:00');

                // 2. Fetch All Students
                const { data: studentsData } = await supabaseAuth
                    .from('users')
                    .select('id, name, profile_pic_url')
                    .eq('role', 'student')
                    .order('name');
                setAllStudents(studentsData || []);

                // 3. Fetch Assigned Students
                const { data: assignedData } = await supabaseAuth
                    .from('session_student_overrides')
                    .select('student_id')
                    .eq('target_classroom_id', roomData.classroom_id);
                
                setSelectedStudents((assignedData || []).map(a => a.student_id));

            } catch (err: any) {
                console.error('Error fetching data:', err);
                console.error('Error details:', {
                    message: err?.message,
                    code: err?.code,
                    details: err?.details,
                    hint: err?.hint,
                    stack: err?.stack
                });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [classId, router]);

    const handleSave = async () => {
        if (!tempClass || !teacherProfile) return;
        setSaving(true);
        try {
            // 1. Update Timings
            const { error: updateError } = await supabaseAuth
                .from('temporary_classes')
                .update({
                    start_time: startTime,
                    end_time: endTime
                })
                .eq('id', classId);
            
            if (updateError) throw updateError;

            // 2. Sync Students
            await supabaseAuth
                .from('session_student_overrides')
                .delete()
                .eq('target_classroom_id', tempClass.classroom_id);
            
            if (selectedStudents.length > 0) {
                const inserts = selectedStudents.map(sid => ({
                    student_id: sid,
                    target_classroom_id: tempClass.classroom_id,
                    override_date: tempClass.class_date,
                    reason: 'Temporary Class Session'
                }));
                const { error: insertError } = await supabaseAuth
                    .from('session_student_overrides')
                    .insert(inserts);
                if (insertError) throw insertError;
            }

            alert('Session updated successfully!');
            router.push('/teacher-dashboard/classrooms');
        } catch (err) {
            console.error('Error saving changes:', err);
            alert('Failed to save changes. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const toggleStudent = (id: string) => {
        setSelectedStudents(prev => 
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    const filteredStudents = allStudents.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6]">
                <Spinner className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 tracking-wide uppercase text-xs">Loading Session...</p>
            </div>
        );
    }

    if (!tempClass) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6]">
                <p className="font-bold text-slate-600">Session not found.</p>
                <Link href="/teacher-dashboard/classrooms" className="mt-4 text-[#ecb613] font-bold">Back to Classrooms</Link>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-[#f8f8f6] dark:bg-[#221d10] font-sans">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={() => {}} />

            <main className="flex-1 flex flex-col min-w-0">
                <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-6 text-slate-900 dark:text-white">
                        <Link href="/teacher-dashboard/classrooms" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <Back className="size-6" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">{tempClass.title}</h1>
                            <p className="text-xs font-bold text-[#ecb613] uppercase tracking-widest mt-1">Manage Temporary Session</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-8 py-3 bg-[#ecb613] text-slate-900 font-black rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0"
                    >
                        {saving ? <Spinner className="size-5 animate-spin" /> : <Done className="size-5" />}
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </header>

                <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
                    <section className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                            <Time className="size-32" />
                        </div>
                        
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                <Time className="size-5" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white">Session Timing</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Start Time</label>
                                <div className="relative">
                                    <select 
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-[#ecb613] rounded-2xl px-6 py-4 appearance-none font-bold text-slate-900 dark:text-white focus:ring-0 transition-all cursor-pointer"
                                    >
                                        {TIME_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <span className="text-xs font-black text-[#ecb613] px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                                            {formatTime12hr(startTime).split(' ')[1]}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1">End Time</label>
                                <div className="relative">
                                    <select 
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-[#ecb613] rounded-2xl px-6 py-4 appearance-none font-bold text-slate-900 dark:text-white focus:ring-0 transition-all cursor-pointer"
                                    >
                                        {TIME_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <span className="text-xs font-black text-[#ecb613] px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                                            {formatTime12hr(endTime).split(' ')[1]}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-500">Date: <span className="font-bold text-slate-900 dark:text-white">{new Date(tempClass.class_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                            <span className="text-xs font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-4 py-1.5 rounded-full uppercase tracking-widest">Confirmed Session</span>
                        </div>
                    </section>

                    <section className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <Group className="size-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Student Roster</h2>
                                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{selectedStudents.length} Students Selected</p>
                                </div>
                            </div>
                            
                            <div className="relative w-full md:w-80">
                                <Find className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                                <input 
                                    type="text" 
                                    placeholder="Search students..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#fef3c7] font-medium"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {filteredStudents.map(student => {
                                const isSelected = selectedStudents.includes(student.id);
                                return (
                                    <div 
                                        key={student.id}
                                        onClick={() => toggleStudent(student.id)}
                                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between group ${isSelected ? 'bg-amber-50 dark:bg-[#ecb613]/10 border-[#ecb613]' : 'bg-slate-50 dark:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className="size-10 rounded-xl bg-slate-200 bg-cover bg-center"
                                                style={{ backgroundImage: `url(${student.profile_pic_url || 'https://avatar.iran.liara.run/public/boy'})` }}
                                            ></div>
                                            <p className={`font-bold text-sm ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{student.name}</p>
                                        </div>
                                        {isSelected ? (
                                            <Check className="size-5 text-[#ecb613]" />
                                        ) : (
                                            <Empty className="size-5 text-slate-300 dark:text-slate-700 group-hover:text-slate-400" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </main>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                }
            `}</style>
        </div>
    );
}
