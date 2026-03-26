'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../../src/lib/supabase-auth';
import { 
    Loader2, ChevronRight, ChevronLeft,
    Library, Upload, Send, FileText, Users, 
    Calendar, X
} from 'lucide-react';
import TeacherSidebar from '../../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../../src/components/TeacherHeader';
import Link from 'next/link';

interface Classroom {
    id: string;
    name: string;
}

interface Student {
    id: string;
    name: string;
    profile_pic_url?: string;
    selected: boolean;
}

export default function CreateTaskPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAssigning, setIsAssigning] = useState(false);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    
    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    
    // Assignment state
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState<string>('');
    const [students, setStudents] = useState<Student[]>([]);
    const [selectAll, setSelectAll] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 12;

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) {
                router.push('/login?type=teacher');
                return;
            }

            const { data: profile } = await supabaseAuth
                .from('users')
                .select('id, name, email, role')
                .eq('id', session.user.id)
                .single();

            if (profile?.role !== 'teacher') {
                router.push('/');
                return;
            }

            setTeacherProfile({ id: profile.id, name: profile.name, email: profile.email });
            
            // Fetch classrooms
            const { data: classes } = await supabaseAuth
                .from('classrooms')
                .select('id, name')
                .eq('teacher_id', session.user.id);
            
            if (classes) {
                setClassrooms(classes);
                if (classes.length > 0) {
                    setSelectedClassroom(classes[0].id);
                }
            }

            setLoading(false);
        };

        checkAuth();
    }, [router]);

    useEffect(() => {
        const fetchStudents = async () => {
            if (!selectedClassroom) return;
            
            const { data } = await supabaseAuth
                .from('classroom_students')
                .select(`
                    student_id,
                    users!student_id(name, profile_pic_url)
                `)
                .eq('classroom_id', selectedClassroom);
            
            if (data) {
                const formatted = data.map((item: any) => ({
                    id: item.student_id,
                    name: item.users?.name || 'Unknown Student',
                    profile_pic_url: item.users?.profile_pic_url || null,
                    selected: true
                }));
                setStudents(formatted);
                setSelectAll(true);
            }
        };

        fetchStudents();
        setCurrentPage(1); // Reset pagination when classroom changes
    }, [selectedClassroom]);

    const handleToggleStudent = (studentId: string) => {
        setStudents(prev => prev.map(s => 
            s.id === studentId ? { ...s, selected: !s.selected } : s
        ));
    };

    const handleToggleAll = (checked: boolean) => {
        setSelectAll(checked);
        setStudents(prev => prev.map(s => ({ ...s, selected: checked })));
    };

    const handleAssignTask = async () => {
        if (!teacherProfile) return;
        if (!title || !description) {
            alert('Please fill in task title and instructions.');
            return;
        }

        const selectedStudentIds = students.filter(s => s.selected).map(s => s.id);
        if (selectedStudentIds.length === 0) {
            alert('Please select at least one student.');
            return;
        }

        setIsAssigning(true);
        try {
            // 1. Create Task
            const { data: task, error: taskError } = await supabaseAuth
                .from('tasks')
                .insert({
                    title,
                    description,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (taskError) throw taskError;

            // 2. Create Task Attempts for each student
            const attempts = selectedStudentIds.map(studentId => ({
                task_id: task.id,
                student_id: studentId,
                status: 'submitted', // Setting to submitted so they show up in review list for testing
                attempt_number: 1,
                submitted_at: new Date().toISOString()
            }));

            const { error: attemptError } = await supabaseAuth
                .from('task_attempts')
                .insert(attempts);

            if (attemptError) throw attemptError;

            alert('Task assigned successfully!');
            router.push('/teacher-dashboard/tasks');

        } catch (error: any) {
            console.error('Error assigning task:', error);
            alert(`Failed to assign task: ${error.message}`);
        } finally {
            setIsAssigning(false);
        }
    };

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 animate-spin text-amber-600 mb-4" />
                <p className="font-medium text-slate-600 font-sans">Loading assignment tools...</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen flex font-sans">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            <main className="flex-1 flex flex-col min-w-0">
                <TeacherHeader title="Create New Task" />

                <div className="flex-1 overflow-y-auto">
                    <div className="p-8 max-w-[1600px] mx-auto w-full">
                        {/* Breadcrumbs */}
                        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6 font-medium">
                            <Link href="/teacher-dashboard/tasks" className="hover:text-amber-600">Tasks</Link>
                            <ChevronRight className="w-4 h-4" />
                            <span className="text-slate-900 dark:text-slate-100 font-bold">Create New Task</span>
                        </nav>

                        {/* Creation Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Primary Form Section */}
                        <div className="lg:col-span-2 space-y-6">
                            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 transition-all hover:shadow-md">
                                <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-8 tracking-tight Inter">Task Assignment</h1>
                                <div className="space-y-6">
                                    {/* Task Title */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide text-xs">Task Title</label>
                                        <input 
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400" 
                                            placeholder="e.g. Master the Mohanam Raga Scale" 
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                        />
                                    </div>
                                    {/* Description */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide text-xs">Detailed Instructions</label>
                                        <textarea 
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400" 
                                            placeholder="Provide specific guidance on breath control and finger placement..." 
                                            rows={6}
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        ></textarea>
                                    </div>
                                    {/* Inventory Library / Attachments */}
                                    <div className="pt-4">
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wide text-xs">Learning Materials</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <button className="group flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-all" type="button">
                                                <Library className="w-8 h-8 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
                                                <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Inventory Library</span>
                                                <span className="text-xs text-slate-500 mt-1">Pick from uploaded sheet music</span>
                                            </button>
                                            <button className="group flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-all" type="button">
                                                <Upload className="w-8 h-8 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
                                                <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Upload New</span>
                                                <span className="text-xs text-slate-500 mt-1">Audio, PDF, or Video</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Secondary Config Section */}
                        <div className="lg:col-span-1 space-y-6">
                            {/* Target Selection Card */}
                            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all hover:shadow-md">
                                <div className="bg-amber-50 dark:bg-amber-900/20 px-6 py-4 border-b border-amber-100 dark:border-amber-900/30">
                                    <h2 className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest Inter">Assignee Configuration</h2>
                                </div>
                                <div className="p-6 space-y-6">
                                    {/* Class Selector */}
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 Inter">Select Class</label>
                                        <div className="relative">
                                            <select 
                                                className="w-full appearance-none px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                                                value={selectedClassroom}
                                                onChange={(e) => setSelectedClassroom(e.target.value)}
                                            >
                                                {classrooms.map(cls => (
                                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                                ))}
                                            </select>
                                            <ChevronRight className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 rotate-90" />
                                        </div>
                                    </div>
                                    {/* Student Selection */}
                                    <div>
                                        <div className="flex justify-between items-center mb-3">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest Inter">Students</label>
                                            <label className="inline-flex items-center cursor-pointer">
                                                <span className="mr-3 text-xs font-bold text-slate-600 dark:text-slate-400">All Students</span>
                                                <div className="relative">
                                                    <input 
                                                        type="checkbox" 
                                                        className="sr-only peer" 
                                                        checked={selectAll}
                                                        onChange={(e) => handleToggleAll(e.target.checked)}
                                                    />
                                                    <div className="w-10 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-amber-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                                                </div>
                                            </label>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto space-y-2">
                                            {students.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(student => (
                                                <label key={student.id} className="flex items-center gap-3 p-3 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-100 dark:hover:border-slate-600 shadow-sm hover:shadow-md">
                                                    <input 
                                                        className="rounded-md text-amber-600 focus:ring-amber-500 w-5 h-5 border-slate-300 dark:border-slate-600" 
                                                        type="checkbox" 
                                                        checked={student.selected}
                                                        onChange={() => handleToggleStudent(student.id)}
                                                    />
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 shadow-sm">
                                                        {student.profile_pic_url ? (
                                                            <img 
                                                                src={student.profile_pic_url} 
                                                                alt={student.name} 
                                                                className="w-full h-full object-cover rounded-full"
                                                                loading="lazy"
                                                            />
                                                        ) : (
                                                            <div className="text-primary text-[10px] font-black">{student.name.charAt(0)}</div>
                                                        )}
                                                    </div>
                                                    <span className={`text-sm font-bold tracking-tight transition-colors ${student.selected ? 'text-primary' : 'text-slate-600'}`}>{student.name}</span>
                                                </label>
                                            ))}
                                            {students.length === 0 && (
                                                <p className="text-xs text-slate-500 text-center py-4 italic font-medium">No students in this class.</p>
                                            )}
                                        </div>
                                        {/* Pagination Controls */}
                                        {students.length > ITEMS_PER_PAGE && (
                                            <div className="flex items-center justify-between mt-4 px-2">
                                                <button 
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </button>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    Page {currentPage} of {Math.ceil(students.length / ITEMS_PER_PAGE)}
                                                </span>
                                                <button 
                                                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(students.length / ITEMS_PER_PAGE), p + 1))}
                                                    disabled={currentPage === Math.ceil(students.length / ITEMS_PER_PAGE)}
                                                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {/* Due Date Picker */}
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 Inter">Due Date</label>
                                        <div className="relative">
                                            <input 
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none font-bold" 
                                                type="date"
                                                value={dueDate}
                                                onChange={(e) => setDueDate(e.target.value)}
                                            />
                                            <Calendar className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Summary / Actions Card */}
                            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 space-y-6">
                                <div className="flex items-center justify-between p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                            <Users className="w-6 h-6 text-amber-600" />
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest Inter block">Recipients</span>
                                            <span className="text-lg font-black text-amber-700 dark:text-amber-400 Inter leading-tight">
                                                {students.filter(s => s.selected).length} Students
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4 pt-2">
                                    <button 
                                        onClick={handleAssignTask}
                                        disabled={isAssigning}
                                        className="w-full py-4 px-6 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl shadow-lg shadow-amber-200 dark:shadow-none transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                                    >
                                        {isAssigning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                        Assign Task
                                    </button>
                                    <button className="w-full py-4 px-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3 border-b-4 active:border-b-0 active:translate-y-1">
                                        <FileText className="w-5 h-5" />
                                        Save as Draft
                                    </button>
                                </div>
                                <p className="text-[10px] text-center text-slate-400 uppercase font-black tracking-widest opacity-60">Students will be notified via email & app</p>
                            </section>
                        </div>
                    </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
