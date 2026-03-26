'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../../src/lib/supabase-auth';
import { 
    Loader2, 
    Calendar as CalendarIcon, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    Search, 
    TrendingUp, 
    Users, 
    ChevronLeft, 
    ChevronRight,
    Filter,
    Download,
    Lightbulb,
    School,
    ArrowDown
} from 'lucide-react';
import TeacherSidebar from '../../../src/components/TeacherSidebar';
import TeacherHeader from '../../../src/components/TeacherHeader';

interface Classroom {
    id: string;
    name: string;
}

interface Student {
    id: string;
    name: string;
    profile_pic_url?: string;
    attendance_status?: 'present' | 'absent' | 'late' | 'excused';
}

export default function AttendancePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    
    // UI State
    const [mode, setMode] = useState<'class' | 'individual'>('class');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [viewDate, setViewDate] = useState(new Date()); // The month being displayed in calendar
    const [searchQuery, setSearchQuery] = useState('');
    
    // Data State
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState<string>('');
    const [students, setStudents] = useState<Student[]>([]);
    const [stats, setStats] = useState({
        total: 0,
        present: 0,
        absent: 0,
        rate: '0%'
    });

    const fetchAttendanceData = useCallback(async (teacherId: string, classroomId: string, date: string) => {
        if (!classroomId) return;

        console.log(`Fetching attendance for class: ${classroomId} on ${date}`);

        // 1. Fetch students in the classroom
        const { data: classStudents, error: classError } = await supabaseAuth
            .from('classroom_students')
            .select(`
                student_id,
                users!student_id(name, profile_pic_url)
            `)
            .eq('classroom_id', classroomId);
        
        if (classError) {
            console.error('Error fetching class students:', classError.message || 'No message', classError.details || 'No details', classError.code || 'No code');
            return;
        }

        console.log(`Found ${classStudents?.length || 0} students in classroom_students`);

        if (classStudents) {
            // 2. Fetch attendance for these students on the selected date
            const studentIds = classStudents.map(cs => cs.student_id);
            const { data: attendanceRecords, error: attendError } = await supabaseAuth
                .from('attendance')
                .select('student_id, status')
                .eq('date', date)
                .in('student_id', studentIds);
            
            if (attendError) {
                console.error('Error fetching attendance records:', attendError.message || 'No message', attendError.details || 'No details', attendError.code || 'No code');
            }

            const attendanceMap = new Map();
            attendanceRecords?.forEach(record => {
                attendanceMap.set(record.student_id, record.status);
            });

            const formattedStudents = classStudents.map((cs: any) => ({
                id: cs.student_id,
                name: cs.users?.name || 'Unknown Student',
                profile_pic_url: cs.users?.profile_pic_url,
                attendance_status: attendanceMap.get(cs.student_id) || undefined
            }));

            setStudents(formattedStudents);

            // 3. Update Stats
            const present = formattedStudents.filter(s => s.attendance_status === 'present').length;
            const absent = formattedStudents.filter(s => s.attendance_status === 'absent').length;
            const total = formattedStudents.length;
            const rate = total > 0 ? `${Math.round((present / total) * 100)}%` : '0%';

            setStats({ total, present, absent, rate });
        }
    }, []);

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
            
            // 1. Fetch classrooms
            const { data: classes } = await supabaseAuth
                .from('classrooms')
                .select('id, name')
                .eq('teacher_id', session.user.id);
            
            if (classes) {
                setClassrooms(classes);
                if (classes.length > 0 && !selectedClassroom) {
                    setSelectedClassroom(classes[0].id);
                }
            }
            setLoading(false);
        };

        checkAuth();
    }, [router, selectedClassroom]);

    const formatDate = (date: Date) => {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    };

    useEffect(() => {
        const fetchStudents = async () => {
            if (!teacherProfile) return;

            if (mode === 'class') {
                if (!selectedClassroom) return;
                await fetchAttendanceData(teacherProfile.id, selectedClassroom, selectedDate);
            } else {
                // Individual Mode: Search or show all assigned students
                let query = supabaseAuth
                    .from('users')
                    .select('id, name, profile_pic_url')
                    .eq('role', 'student')
                    .eq('teacher_id', teacherProfile.id);
                
                if (searchQuery.length >= 2) {
                    query = query.ilike('name', `%${searchQuery}%`);
                }

                const { data: searchResults } = await query;
                
                if (searchResults) {
                    const studentIds = searchResults.map(s => s.id);
                    const { data: attendanceRecords } = await supabaseAuth
                        .from('attendance')
                        .select('student_id, status')
                        .eq('date', selectedDate)
                        .in('student_id', studentIds);

                    const attendanceMap = new Map();
                    attendanceRecords?.forEach(record => {
                        attendanceMap.set(record.student_id, record.status);
                    });

                    const formatted = searchResults.map(s => ({
                        id: s.id,
                        name: s.name,
                        profile_pic_url: s.profile_pic_url,
                        attendance_status: attendanceMap.get(s.id) || undefined
                    }));

                    setStudents(formatted);

                    // Update stats for individual view too
                    const present = formatted.filter(s => s.attendance_status === 'present').length;
                    const absent = formatted.filter(s => s.attendance_status === 'absent').length;
                    const total = formatted.length;
                    const rate = total > 0 ? `${Math.round((present / total) * 100)}%` : '0%';
                    setStats({ total, present, absent, rate });
                }
            }
        };

        fetchStudents();
    }, [mode, selectedClassroom, searchQuery, selectedDate, teacherProfile, fetchAttendanceData]);

    const handleMarkAttendance = async (studentId: string, status: 'present' | 'absent' | 'late') => {
        if (!selectedClassroom || !teacherProfile) return;

        try {
            const { error } = await supabaseAuth
                .from('attendance')
                .upsert({
                    student_id: studentId,
                    classroom_id: selectedClassroom,
                    date: selectedDate,
                    status,
                    marked_by: teacherProfile.id,
                    created_at: new Date().toISOString()
                }, { onConflict: 'student_id, classroom_id, date' });

            if (error) throw error;

            // Update local state
            setStudents(prev => prev.map(s => 
                s.id === studentId ? { ...s, attendance_status: status } : s
            ));

            // Refresh stats
            const updatedStudents = students.map(s => s.id === studentId ? { ...s, attendance_status: status } : s);
            const present = updatedStudents.filter(s => s.attendance_status === 'present').length;
            const total = updatedStudents.length;
            setStats(prev => ({
                ...prev,
                present,
                absent: updatedStudents.filter(s => s.attendance_status === 'absent').length,
                rate: total > 0 ? `${Math.round((present / total) * 100)}%` : '0%'
            }));

        } catch (error: any) {
            console.error('Error marking attendance:', error);
            alert(`Failed to mark attendance: ${error.message}`);
        }
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
        return days;
    };

    const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-background">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="font-medium text-on-surface-variant">Loading attendance...</p>
            </div>
        );
    }

    return (
        <div className="bg-background text-on-background min-h-screen flex font-body">
            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            <main className="flex-1 flex flex-col min-w-0">
                <header className="sticky top-0 z-30 flex items-center justify-between px-8 h-16 bg-white border-b border-slate-200 shadow-sm font-headline">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-slate-900">Attendance Management</h2>
                        <div className="h-6 w-[1px] bg-slate-200 mx-2"></div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                            <CalendarIcon className="w-4 h-4" />
                            <span>{new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <button className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity shadow-sm">
                            <Download className="w-4 h-4" />
                            Export Report
                        </button>
                    </div>
                </header>

                <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full flex-1">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-amber-50 rounded-xl text-amber-600 transition-colors group-hover:bg-amber-100">
                                    <Users className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase">Stable</span>
                            </div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Students</p>
                            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.total}</h3>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-green-50 rounded-xl text-green-600 transition-colors group-hover:bg-green-100">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-sans">Today</span>
                            </div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Present</p>
                            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.present}</h3>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-red-50 rounded-xl text-red-600 transition-colors group-hover:bg-red-100">
                                    <XCircle className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded-full uppercase">High</span>
                            </div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider font-sans">Absent Today</p>
                            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.absent}</h3>
                        </div>
                        <div className="bg-primary text-on-primary p-6 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-white/20 rounded-xl">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                            </div>
                            <p className="text-on-primary/80 text-xs font-bold uppercase tracking-wider font-sans">Attendance Rate</p>
                            <h3 className="text-3xl font-black mt-1">{stats.rate}</h3>
                        </div>
                    </div>

                    {/* Mode Selector */}
                    <div className="flex items-center justify-between">
                        <div className="bg-white p-1 rounded-2xl border border-slate-200 flex gap-1 shadow-sm">
                            <button 
                                onClick={() => setMode('class')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === 'class' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Class Marking
                            </button>
                            <button 
                                onClick={() => setMode('individual')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === 'individual' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Individual Marking
                            </button>
                        </div>
                        
                        {mode === 'class' && (
                            <div className="flex gap-4">
                                <select 
                                    className="bg-white border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary focus:border-primary outline-none px-4 py-2.5 shadow-sm"
                                    value={selectedClassroom}
                                    onChange={(e) => setSelectedClassroom(e.target.value)}
                                >
                                    {classrooms.map(cls => (
                                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Main Content Area */}
                    <div className="grid grid-cols-12 gap-8">
                        {/* Calendar Column */}
                        <div className="col-span-12 lg:col-span-4 space-y-6">
                            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md">
                                <div className="flex items-center justify-between mb-8">
                                    <h4 className="font-extrabold text-slate-900 tracking-tight">
                                        {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                    </h4>
                                    <div className="flex gap-1">
                                        <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><ChevronLeft className="w-4 h-4 text-slate-600" /></button>
                                        <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><ChevronRight className="w-4 h-4 text-slate-600" /></button>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-7 gap-1 text-center mb-6">
                                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                        <div key={day} className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</div>
                                    ))}
                                </div>
                                
                                <div className="grid grid-cols-7 gap-2">
                                    {getDaysInMonth(viewDate).map((day, idx) => {
                                        if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;
                                        
                                        const dateStr = formatDate(day);
                                        const isSelected = selectedDate === dateStr;
                                        
                                        return (
                                            <button 
                                                key={dateStr}
                                                onClick={() => setSelectedDate(dateStr)}
                                                className={`aspect-square flex items-center justify-center text-xs font-bold rounded-xl transition-all ${
                                                    isSelected
                                                    ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 scale-110'
                                                    : 'hover:bg-slate-50 text-slate-600'
                                                }`}
                                            >
                                                {day.getDate()}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="bg-primary/10 p-8 rounded-[2rem] border border-primary/20 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                    <Lightbulb className="w-16 h-16" />
                                </div>
                                <h4 className="font-black text-on-primary-container mb-3 flex items-center gap-2 tracking-tight">
                                    <Lightbulb className="w-5 h-5 text-primary" />
                                    Quick Hint
                                </h4>
                                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                                    Marking a student individually will automatically update their attendance for the specific session across all class reports.
                                </p>
                            </div>
                        </div>

                        {/* List Column */}
                        <div className="col-span-12 lg:col-span-8 space-y-6 flex flex-col h-full">
                            {/* Search (for both modes but primarily individual) */}
                            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md">
                                <div className="relative">
                                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input 
                                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/50 text-sm font-medium transition-all" 
                                        placeholder={mode === 'class' ? "Search within this class..." : "Search any student in academy..."}
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Students List */}
                            <div className="flex-1 space-y-4">
                                <div className="flex items-center justify-between px-4">
                                    <h4 className="font-extrabold text-slate-900 tracking-tight">
                                        {mode === 'class' ? 'Class Participants' : 'Search Results'}
                                    </h4>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        {students.length} Found
                                    </span>
                                </div>

                                <div className="grid gap-4">
                                    {students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(student => (
                                        <div key={student.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-6 group hover:border-primary/30 transition-all hover:shadow-lg">
                                            <div className="flex items-center gap-5 flex-1">
                                                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform overflow-hidden relative border-2 border-slate-50">
                                                    {student.profile_pic_url ? (
                                                        <img 
                                                            src={student.profile_pic_url} 
                                                            alt={student.name} 
                                                            className="w-full h-full object-cover rounded-full"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="text-primary font-black text-xl">{student.name.charAt(0)}</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <h5 className="font-extrabold text-slate-900 text-lg tracking-tight">{student.name}</h5>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <School className="w-3 h-3 text-slate-400" />
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[150px]">Intermediate Flute</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Session</label>
                                                <div className="relative">
                                                    <select className="text-xs font-black border-none rounded-xl py-3 bg-slate-50 min-w-[160px] focus:ring-2 focus:ring-primary/50 outline-none appearance-none pr-10 pl-4 tracking-tight">
                                                        <option>Saturday 9:00 AM</option>
                                                        <option>Saturday 11:00 AM</option>
                                                    </select>
                                                    <ArrowDown className="w-3 h-3 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => handleMarkAttendance(student.id, 'present')}
                                                    className={`px-6 py-3 rounded-xl text-xs font-black transition-all ${
                                                        student.attendance_status === 'present'
                                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                                                        : 'border-2 border-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-500'
                                                    }`}
                                                >
                                                    Present
                                                </button>
                                                <button 
                                                    onClick={() => handleMarkAttendance(student.id, 'absent')}
                                                    className={`px-6 py-3 rounded-xl text-xs font-black transition-all ${
                                                        student.attendance_status === 'absent'
                                                        ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                                                        : 'border-2 border-red-50 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500'
                                                    }`}
                                                >
                                                    Absent
                                                </button>
                                                <button 
                                                    onClick={() => handleMarkAttendance(student.id, 'late')}
                                                    className={`px-6 py-3 rounded-xl text-xs font-black transition-all ${
                                                        student.attendance_status === 'late'
                                                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-200'
                                                        : 'border-2 border-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white hover:border-amber-500'
                                                    }`}
                                                >
                                                    Late
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {students.length === 0 && (
                                        <div className="bg-white p-12 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                                                <Search className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <h5 className="font-extrabold text-slate-400 tracking-tight">No students found</h5>
                                            <p className="text-xs text-slate-400 mt-1">Try selecting a different classroom or adjusting your search.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Load More (Simplified) */}
                            {students.length > 5 && (
                                <div className="flex items-center justify-center pt-4">
                                    <button className="flex items-center gap-2 text-xs font-black text-slate-500 hover:text-primary transition-all py-3 px-8 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0">
                                        <ArrowDown className="w-4 h-4" />
                                        Show All Search Results
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
