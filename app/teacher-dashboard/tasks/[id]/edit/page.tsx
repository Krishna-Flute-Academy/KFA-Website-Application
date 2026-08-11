'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth } from '../../../../../src/lib/supabase-auth';
import { 
    Loader2, ChevronRight, ChevronLeft,
    Library, Upload, Send, FileText, Users, 
    Calendar, X, Save
} from 'lucide-react';
import TeacherSidebar from '../../../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../../../src/components/TeacherHeader';
import Link from 'next/link';
import { sortClassroomsByDayAndTime } from '../../../../../src/lib/classroomSort';

interface Classroom {
    id: string;
    name: string;
    teacher_id?: string;
}

interface Student {
    id: string;
    name: string;
    profile_pic_url?: string;
    selected: boolean;
    classroom_ids: string[];
}

interface Assignment {
    id: string;
    classroom_id: string;
    teacher_id: string;
    title: string;
    description: string;
    due_date: string | null;
    target_type: 'all' | 'individual';
    status: 'draft' | 'active';
}

export default function EditTaskPage() {
    const router = useRouter();
    const params = useParams();
    const assignmentId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string; role?: string; profile_pic_url?: string } | null>(null);
    const [assignment, setAssignment] = useState<Assignment | null>(null);
    
    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    
    // Assignment state
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
    const [students, setStudents] = useState<Student[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [studentSearch, setStudentSearch] = useState('');
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
                .select('id, name, email, role, profile_pic_url')
                .eq('id', session.user.id)
                .single();

            if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
                router.push('/');
                return;
            }

            setTeacherProfile({ id: profile.id, name: profile.name, email: profile.email, role: profile.role });
            const isAdmin = profile.role === 'admin';
            
            // Fetch classrooms
            const classesQuery = supabaseAuth
                .from('classrooms')
                .select('id, name, teacher_id');
            const { data: classes } = isAdmin
                ? await classesQuery
                : await classesQuery.eq('teacher_id', session.user.id);
            
            if (classes) {
                setClassrooms(classes);
            }
        };

        checkAuth();
    }, [router]);

    useEffect(() => {
        const fetchAssignmentAndStudents = async () => {
            if (!teacherProfile || !assignmentId) return;

            try {
                // 1. Fetch assignment details
                let assignmentData: any = null;
                const { data: asg, error: asgError } = await supabaseAuth
                    .from('assignments')
                    .select('id, title, description, due_date, classroom_id, status, target_type')
                    .eq('id', assignmentId)
                    .single();

                if (asgError || !asg) {
                    console.error('Error fetching assignment:', asgError);
                    alert('Could not load assignment details.');
                    router.push('/teacher-dashboard/tasks');
                    return;
                }

                // Restrict access for teachers
                const isAdmin = teacherProfile.role === 'admin';
                if (!isAdmin) {
                    const ownsClassroom = classrooms.some(c => c.id === asg.classroom_id);
                    if (!ownsClassroom) {
                        alert('You are not authorized to edit this task.');
                        router.push('/teacher-dashboard/tasks');
                        return;
                    }
                }
                
                assignmentData = asg;
                setAssignment(assignmentData);
                setTitle(assignmentData.title || '');
                setDescription(assignmentData.description || '');
                
                // Format date for input: YYYY-MM-DD
                if (assignmentData.due_date) {
                    const d = new Date(assignmentData.due_date);
                    const formattedDate = d.toISOString().split('T')[0];
                    setDueDate(formattedDate);
                } else {
                    setDueDate('');
                }
                
                setSelectedClassroom(assignmentData.classroom_id || 'all');

                // 2. Fetch all enrolled students for this teacher's classrooms
                const classroomIds = classrooms.map(c => c.id);
                if (classroomIds.length === 0) {
                    setLoading(false);
                    return;
                }

                const { data: enrollments, error: enrollError } = await supabaseAuth
                    .from('classroom_students')
                    .select('student_id, classroom_id')
                    .in('classroom_id', classroomIds);

                if (enrollError || !enrollments || enrollments.length === 0) {
                    console.error('Error or no enrollments:', enrollError);
                    setLoading(false);
                    return;
                }

                const studentIds = [...new Set(enrollments.map(e => e.student_id))];

                const studentClassroomMap: Record<string, string[]> = {};
                enrollments.forEach(e => {
                    if (!studentClassroomMap[e.student_id]) {
                        studentClassroomMap[e.student_id] = [];
                    }
                    studentClassroomMap[e.student_id].push(e.classroom_id);
                });

                // 3. Fetch current mappings from assignment_students to pre-check them
                const { data: currentMappings, error: mappingsError } = await supabaseAuth
                    .from('assignment_students')
                    .select('student_id')
                    .eq('assignment_id', assignmentId);

                const assignedIds = new Set((currentMappings || []).map(m => m.student_id));

                // 4. Fetch user details for students
                const { data: studentUsers, error: usersError } = await supabaseAuth
                    .from('users')
                    .select('id, name, profile_pic_url')
                    .in('id', studentIds);

                if (usersError) {
                    console.error('Error fetching student details:', usersError);
                    setLoading(false);
                    return;
                }

                if (studentUsers) {
                    const formatted = studentUsers.map((item: any) => ({
                        id: item.id,
                        name: item.name || 'Unknown Student',
                        profile_pic_url: item.profile_pic_url || null,
                        selected: assignedIds.has(item.id),
                        classroom_ids: studentClassroomMap[item.id] || []
                    }));
                    setStudents(formatted);
                    
                    // If target_type is 'all' and it's active, select all in this classroom
                    if (assignmentData.target_type === 'all' && assignmentData.status !== 'draft') {
                        setSelectAll(true);
                    }
                }
            } catch (err) {
                console.error('Error in fetchAssignmentAndStudents:', err);
            } finally {
                setLoading(false);
            }
        };

        if (classrooms.length > 0) {
            fetchAssignmentAndStudents();
        }
    }, [teacherProfile, assignmentId, classrooms, router]);

    const filteredStudents = React.useMemo(() => {
        let result = students;
        if (selectedClassroom && selectedClassroom !== 'all') {
            result = result.filter(s => s.classroom_ids?.includes(selectedClassroom));
        }
        if (studentSearch.trim() !== '') {
            const lowerQuery = studentSearch.toLowerCase();
            result = result.filter(s => s.name.toLowerCase().includes(lowerQuery));
        }
        return result;
    }, [students, selectedClassroom, studentSearch]);

    // Reset pagination when selected classroom filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedClassroom, studentSearch]);

    const handleToggleStudent = (studentId: string) => {
        setStudents(prev => prev.map(s => 
            s.id === studentId ? { ...s, selected: !s.selected } : s
        ));
    };

    const handleToggleAll = (checked: boolean) => {
        setSelectAll(checked);
        const filteredIds = new Set(filteredStudents.map(s => s.id));
        setStudents(prev => prev.map(s => 
            filteredIds.has(s.id) ? { ...s, selected: checked } : s
        ));
    };

    const handleSaveEditedTask = async (isDraft: boolean = false) => {
        if (!teacherProfile || !assignment) return;
        if (!title || !description) {
            alert('Please fill in task title and instructions.');
            return;
        }

        const selectedStudents = students.filter(s => s.selected);
        if (!isDraft && selectedStudents.length === 0) {
            alert('Please select at least one student.');
            return;
        }

        setIsSaving(true);
        try {
            // Group selected students by classroom ID
            const studentsByClass: Record<string, string[]> = {};
            
            if (selectedStudents.length > 0) {
                selectedStudents.forEach(s => {
                    let studentClassId = assignment.classroom_id;
                    if (selectedClassroom && selectedClassroom !== 'all') {
                        studentClassId = selectedClassroom;
                    } else if (s.classroom_ids && s.classroom_ids.length > 0) {
                        studentClassId = s.classroom_ids[0];
                    }
                    
                    if (!studentsByClass[studentClassId]) {
                        studentsByClass[studentClassId] = [];
                    }
                    studentsByClass[studentClassId].push(s.id);
                });
            } else {
                // If saving as draft with no selected students, keep the current or selected classroom
                const classId = selectedClassroom === 'all' ? assignment.classroom_id : selectedClassroom;
                studentsByClass[classId] = [];
            }

            const classGroups = Object.entries(studentsByClass);
            
            // Step 1: Update/Publish the original assignment with the first group
            const [primaryClassId, primaryStudentIds] = classGroups[0] || [assignment.classroom_id, []];
            
            const isAdmin = teacherProfile.role === 'admin';
            if (!isAdmin) {
                const ownsClassroom = classrooms.some(c => c.id === primaryClassId);
                if (!ownsClassroom) {
                    alert("You are not authorized to assign tasks to this classroom.");
                    return;
                }
            }

            const primaryClassroomObj = classrooms.find(c => c.id === primaryClassId);
            const primaryTeacherId = primaryClassroomObj?.teacher_id || teacherProfile.id;

            const updateData: any = {
                title,
                description,
                due_date: dueDate || null,
                classroom_id: primaryClassId,
                teacher_id: primaryTeacherId,
                target_type: selectedClassroom === 'all' && selectAll ? 'all' : 'individual',
                status: isDraft ? 'draft' : 'active'
            };

            let { error: updateError } = await supabaseAuth
                .from('assignments')
                .update(updateData)
                .eq('id', assignmentId);

            // FALLBACK: If status column is missing on DB, retry updating without status column
            if (updateError && (updateError.code === '42703' || updateError.message?.includes('status'))) {
                console.warn('status column missing in assignments, running fallback update...');
                delete updateData.status;
                const fallback = await supabaseAuth
                    .from('assignments')
                    .update(updateData)
                    .eq('id', assignmentId);
                updateError = fallback.error;
            }

            if (updateError) throw updateError;

            // Sync student mappings for the primary assignment
            if (isDraft) {
                // Draft assignments have no assigned students in DB
                const { error: deleteError } = await supabaseAuth
                    .from('assignment_students')
                    .delete()
                    .eq('assignment_id', assignmentId);
                if (deleteError) console.error('Error clearing old mappings for draft:', deleteError);
            } else {
                // Fetch currently assigned student IDs for this assignment
                const { data: currentMappings } = await supabaseAuth
                    .from('assignment_students')
                    .select('student_id')
                    .eq('assignment_id', assignmentId);

                const existingStudentIds = new Set((currentMappings || []).map(m => m.student_id));
                const targetStudentIds = new Set(primaryStudentIds);

                // Students to remove
                const toRemove = [...existingStudentIds].filter(id => !targetStudentIds.has(id));
                if (toRemove.length > 0) {
                    await supabaseAuth
                        .from('assignment_students')
                        .delete()
                        .eq('assignment_id', assignmentId)
                        .in('student_id', toRemove);
                }

                // Students to add
                const toAdd = primaryStudentIds.filter(id => !existingStudentIds.has(id));
                if (toAdd.length > 0) {
                    const newMappings = toAdd.map(studentId => ({
                        assignment_id: assignmentId,
                        student_id: studentId,
                        status: 'pending'
                    }));
                    const { error: insertError } = await supabaseAuth
                        .from('assignment_students')
                        .insert(newMappings);
                    if (insertError) throw insertError;
                }
            }

            // Step 2: For other classroom groups, create completely new assignments (Partitioning Logic)
            if (classGroups.length > 1) {
                for (let i = 1; i < classGroups.length; i++) {
                    const [classId, studentIds] = classGroups[i];
                    if (studentIds.length === 0) continue;

                    const classroomObj = classrooms.find(c => c.id === classId);
                    const classTeacherId = classroomObj?.teacher_id || teacherProfile.id;

                    const newInsertData: any = {
                        classroom_id: classId,
                        teacher_id: classTeacherId,
                        title,
                        description,
                        due_date: dueDate || null,
                        target_type: 'individual',
                        status: isDraft ? 'draft' : 'active',
                        created_at: new Date().toISOString()
                    };

                    let { data: newAssignment, error: newAssignmentError } = await supabaseAuth
                        .from('assignments')
                        .insert(newInsertData)
                        .select()
                        .single();

                    if (newAssignmentError && (newAssignmentError.code === '42703' || newAssignmentError.message?.includes('status'))) {
                        delete newInsertData.status;
                        const fallback = await supabaseAuth
                            .from('assignments')
                            .insert(newInsertData)
                            .select()
                            .single();
                        newAssignment = fallback.data;
                        newAssignmentError = fallback.error;
                    }

                    if (newAssignmentError) throw newAssignmentError;

                    if (!isDraft && newAssignment && studentIds.length > 0) {
                        const newMappings = studentIds.map(studentId => ({
                            assignment_id: newAssignment.id,
                            student_id: studentId,
                            status: 'pending'
                        }));
                        const { error: mappingError } = await supabaseAuth
                            .from('assignment_students')
                            .insert(newMappings);
                        if (mappingError) throw mappingError;
                    }
                }
            }

            alert(isDraft ? 'Task draft saved successfully!' : 'Task changes saved successfully!');
            router.push('/teacher-dashboard/tasks');

        } catch (error: any) {
            console.error('Error saving/publishing task:', error);
            alert(`Failed to save task: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6] dark:bg-[#221d10]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 dark:text-slate-400">Loading task details...</p>
            </div>
        );
    }

    return (
        <div className="bg-[#f8f8f6] dark:bg-[#221d10] text-slate-900 dark:text-slate-100 min-h-screen flex font-sans">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            <main className="flex-1 flex flex-col min-w-0">
                <TeacherHeader title="Edit Task" />

                <div className="flex-1 overflow-y-auto">
                    <div className="p-8 max-w-[1600px] mx-auto w-full">
                        {/* Breadcrumbs */}
                        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6 font-medium">
                            <Link href="/teacher-dashboard/tasks" className="hover:text-amber-600">Tasks</Link>
                            <ChevronRight className="w-4 h-4" />
                            <span className="text-slate-900 dark:text-slate-100 font-bold">Edit Task</span>
                        </nav>

                        {/* Creation Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Primary Form Section */}
                            <div className="lg:col-span-2 space-y-6">
                                <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 transition-all hover:shadow-md">
                                    <div className="flex justify-between items-center mb-8">
                                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight Inter">Edit Task</h1>
                                        {assignment?.status === 'draft' && (
                                            <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 tracking-wider">
                                                Draft
                                            </span>
                                        )}
                                    </div>
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
                                                    <option value="all">All Students (Student Directory)</option>
                                                     {sortClassroomsByDayAndTime(classrooms).map(cls => (
                                                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                                                    ))}
                                                </select>
                                                <ChevronRight className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 rotate-90" />
                                            </div>
                                        </div>
                                        {/* Student Selection */}
                                        <div>
                                            <div className="relative mb-3">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                                <input
                                                    type="text"
                                                    placeholder="Search students..."
                                                    value={studentSearch}
                                                    onChange={(e) => setStudentSearch(e.target.value)}
                                                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] outline-none transition-all placeholder:text-slate-400"
                                                />
                                            </div>
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
                                                {filteredStudents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(student => (
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
                                                {filteredStudents.length === 0 && (
                                                    <p className="text-xs text-slate-500 text-center py-4 italic font-medium">No students found.</p>
                                                )}
                                            </div>
                                            {/* Pagination Controls */}
                                            {filteredStudents.length > ITEMS_PER_PAGE && (
                                                <div className="flex items-center justify-between mt-4 px-2">
                                                    <button 
                                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                        disabled={currentPage === 1}
                                                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                                                    >
                                                        <ChevronLeft className="w-4 h-4" />
                                                    </button>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        Page {currentPage} of {Math.ceil(filteredStudents.length / ITEMS_PER_PAGE)}
                                                    </span>
                                                    <button 
                                                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredStudents.length / ITEMS_PER_PAGE), p + 1))}
                                                        disabled={currentPage === Math.ceil(filteredStudents.length / ITEMS_PER_PAGE)}
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
                                            type="button"
                                            onClick={() => handleSaveEditedTask(false)}
                                            disabled={isSaving}
                                            className="w-full py-4 px-6 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl shadow-lg shadow-amber-200 dark:shadow-none transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                                        >
                                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                            {assignment?.status === 'draft' ? 'Publish & Assign' : 'Save Changes'}
                                        </button>
                                        
                                        {/* Show Save as Draft only if it's currently a draft, OR let teachers convert active back to draft if desired */}
                                        <button 
                                            type="button"
                                            onClick={() => handleSaveEditedTask(true)}
                                            disabled={isSaving}
                                            className="w-full py-4 px-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3 border-b-4 active:border-b-0 active:translate-y-1 disabled:opacity-50"
                                        >
                                            <FileText className="w-5 h-5" />
                                            Save as Draft
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-center text-slate-400 uppercase font-black tracking-widest opacity-60">Students will be notified of updates</p>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
