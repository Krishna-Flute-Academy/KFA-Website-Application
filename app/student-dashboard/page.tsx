'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '../../src/lib/supabase-auth';
import { 
    Loader2, BookOpen, Calendar, Mail, FileText, CheckCircle, 
    Clock, Video, Play, Music, Award, Users, Search, PlayCircle, 
    Send, X, ClipboardList, Info, BarChart2, Plus, Volume2, 
    HelpCircle, ChevronRight, Download, LogOut, Check, Menu,
    Sparkles
} from 'lucide-react';
import dynamic from 'next/dynamic';

const PracticeSuiteModal = dynamic(() => import('../../src/components/PracticeSuiteModal'), { ssr: false });

interface StudentProfile {
    id: string;
    name: string;
    email: string;
    level?: string;
    profile_pic_url?: string;
    role?: string;
    teacher_id?: string | null;
}

interface EnrichedAssignment {
    id: string;
    title: string;
    description?: string;
    due_date?: string;
    file_url?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    status: 'pending' | 'submitted' | 'reviewed' | 'approved';
    score?: number | null;
    proficiency_level?: string | null;
    feedback_text?: string | null;
    video_url?: string | null;
    submitted_at?: string | null;
}

interface ClassroomInfo {
    id: string;
    name: string;
    teacher_id?: string;
    teacher_name?: string;
    teacher_email?: string;
    description?: string;
}

interface Classmate {
    id: string;
    name: string;
    level: string;
    profile_pic_url: string | null;
}

interface AttendanceRecord {
    id: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'excused';
}

interface Broadcast {
    id: string;
    channel: string;
    subject: string;
    content: string;
    audio_attachment?: string | null;
    created_at: string;
    sender?: {
        name: string;
        role: string;
    } | null;
}

interface ClassNote {
    id: string;
    title: string;
    content?: string;
    file_url?: string;
    file_name?: string;
    file_size?: number;
    color?: string;
    created_at: string;
}

export default function StudentDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [classroom, setClassroom] = useState<ClassroomInfo | null>(null);
    const [classmates, setClassmates] = useState<Classmate[]>([]);
    const [assignments, setAssignments] = useState<EnrichedAssignment[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [sessionLogs, setSessionLogs] = useState<any[]>([]);
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [classNotes, setClassNotes] = useState<ClassNote[]>([]);
    
    // Curriculum states
    const [courseModules, setCourseModules] = useState<any[]>([]);
    const [courseChapters, setCourseChapters] = useState<any[]>([]);
    const [courseLessons, setCourseLessons] = useState<any[]>([]);
    const [studentProgress, setStudentProgress] = useState<any[]>([]);
    const [classroomInventoryAllocations, setClassroomInventoryAllocations] = useState<any[]>([]);
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
    const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

    // UI Navigation state
    const [activeTab, setActiveTab] = useState<'overview' | 'curriculum' | 'tasks' | 'messages' | 'attendance' | 'library'>('overview');
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [showPracticeSuite, setShowPracticeSuite] = useState(false);
    const [practiceSuiteTab, setPracticeSuiteTab] = useState<'metronome' | 'drums'>('metronome');

    // Submission modal/drawer states
    const [selectedAssignment, setSelectedAssignment] = useState<EnrichedAssignment | null>(null);
    const [submitVideoUrl, setSubmitVideoUrl] = useState('');
    const [isSubmittingTask, setIsSubmittingTask] = useState(false);

    // Audio voice broadcast states
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [isAudioPaused, setIsAudioPaused] = useState(false);
    const [audioVolume, setAudioVolume] = useState(0.8);

    // Excuse Request Modal states
    const [showExcuseModal, setShowExcuseModal] = useState(false);
    const [excuseDate, setExcuseDate] = useState('');
    const [excuseReason, setExcuseReason] = useState('');
    const [isSubmittingExcuse, setIsSubmittingExcuse] = useState(false);

    const refreshData = async () => {
        try {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            if (!session) { router.push('/login'); return; }

            const userId = session.user.id;

            // 1. Fetch student profile
            const { data: user } = await supabaseAuth
                .from('users')
                .select('id, name, email, level, profile_pic_url, role, teacher_id')
                .eq('id', userId)
                .maybeSingle();

            if (!user || user.role === 'teacher') { router.push('/'); return; }
            setProfile(user);

            // 2. Fetch classroom mapping
            let csData: any = null;
            const { data: initialData, error: csError } = await supabaseAuth
                .from('classroom_students')
                .select('classroom_id, classrooms(id, name, description, teacher_id, users!classrooms_teacher_id_fkey(name, email))')
                .eq('student_id', userId);
            
            console.log('DEBUG: Classroom fetch initialData:', initialData);
            console.log('DEBUG: Classroom fetch csError:', csError);
            console.log('DEBUG: student_id used:', userId);
            
            csData = initialData;

            if (csError || !initialData || initialData.length === 0) {
                console.log('DEBUG: Attempting fallback queries...');
                // Try fallback query without users join
                const { data: fallbackData } = await supabaseAuth
                    .from('classroom_students')
                    .select('classroom_id, classrooms(id, name, description, teacher_id)')
                    .eq('student_id', userId);
                
                if (fallbackData && fallbackData.length > 0) {
                    csData = fallbackData;
                    console.log('DEBUG: Used classroom_students fallback:', fallbackData);
                } else if (user.teacher_id) {
                    // ULTIMATE FALLBACK: RLS might be blocking classroom_students for students!
                    // Just fetch the classrooms belonging to their teacher_id directly.
                    console.log('DEBUG: RLS likely blocked classroom_students. Fetching classrooms directly for teacher:', user.teacher_id);
                    const { data: directClassrooms } = await supabaseAuth
                        .from('classrooms')
                        .select('id, name, description, teacher_id')
                        .eq('teacher_id', user.teacher_id);
                    
                    console.log('DEBUG: Direct classrooms fetch:', directClassrooms);
                    
                    if (directClassrooms && directClassrooms.length > 0) {
                        // Artificially construct csData
                        csData = [{
                            classroom_id: directClassrooms[0].id,
                            classrooms: directClassrooms[0]
                        }];
                    } else {
                        console.log('DEBUG: RLS blocked EVERYTHING. Creating synthetic classroom.');
                        // ULTIMATE SYNTHETIC FALLBACK
                        const { data: teacherUser } = await supabaseAuth
                            .from('users')
                            .select('name, email')
                            .eq('id', user.teacher_id)
                            .maybeSingle();

                        csData = [{
                            classroom_id: 'synthetic-classroom',
                            classrooms: {
                                id: 'synthetic-classroom',
                                name: 'My Assigned Batch',
                                teacher_id: user.teacher_id,
                                users: teacherUser
                            }
                        }];
                    }
                }
            }

            const cs = csData && csData.length > 0 ? csData[0] : null;

            let classroomId = '';
            if (cs?.classrooms) {
                const cls = Array.isArray(cs.classrooms) ? cs.classrooms[0] : cs.classrooms;
                if (cls) {
                    classroomId = cls.id;
                    let teacherUser = Array.isArray(cls.users) ? cls.users[0] : cls.users;
                    
                    // If we had to use the fallback, fetch teacher separately
                    if (!teacherUser && cls.teacher_id) {
                        const { data: tData } = await supabaseAuth
                            .from('users')
                            .select('name, email')
                            .eq('id', cls.teacher_id)
                            .maybeSingle();
                        if (tData) teacherUser = tData;
                    }

                    setClassroom({
                        id: cls.id,
                        name: cls.name,
                        description: cls.description || '',
                        teacher_id: cls.teacher_id,
                        teacher_name: teacherUser?.name || 'Academy Instructor',
                        teacher_email: teacherUser?.email || ''
                    });

                // Fetch classmates in same classroom OR same teacher
                let classmatesList = [];
                if (classroomId === 'synthetic-classroom') {
                    const { data } = await supabaseAuth
                        .from('users')
                        .select('id, name, level, profile_pic_url')
                        .eq('teacher_id', cls.teacher_id)
                        .eq('role', 'student')
                        .neq('id', userId);
                    if (data) classmatesList = data.map(u => ({ student_id: u.id, users: u }));
                } else {
                    const { data } = await supabaseAuth
                        .from('classroom_students')
                        .select('student_id, users!student_id(id, name, level, profile_pic_url)')
                        .eq('classroom_id', cls.id)
                        .neq('student_id', userId);
                    if (data) classmatesList = data;
                }

                if (classmatesList) {
                    const formattedClassmates = classmatesList.map((c: any) => ({
                        id: c.users?.id || c.student_id,
                        name: c.users?.name || 'Classmate',
                        level: c.users?.level || 'Beginner',
                        profile_pic_url: c.users?.profile_pic_url || null
                    }));
                    setClassmates(formattedClassmates);
                }

                // Fetch class notes
                const { data: notes } = await supabaseAuth
                    .from('class_notes')
                    .select('*')
                    .eq('classroom_id', cls.id)
                    .order('created_at', { ascending: false });
                setClassNotes(notes || []);
                }
            }

            // 3. Fetch Tasks and Task Attempts (two-pronged approach)
            // Prong A: Fetch all tasks assigned to student's classroom (so new students see tasks even before any submission)
            let classroomTasks: any[] = [];
            if (classroomId && classroomId !== 'synthetic-classroom') {
                const { data: ctData } = await supabaseAuth
                    .from('tasks')
                    .select('*')
                    .eq('classroom_id', classroomId)
                    .order('created_at', { ascending: false });
                if (ctData) classroomTasks = ctData;
            }

            // Prong B: Fetch actual attempt records for this student (contains status, score, feedback)
            const { data: attempts } = await supabaseAuth
                .from('task_attempts')
                .select('id, task_id, status, feedback_text, score, submitted_at, file_url')
                .eq('student_id', userId);

            // Build a quick lookup map: task_id → attempt
            const attemptMap = new Map<string, any>();
            (attempts || []).forEach((a: any) => {
                if (a.task_id) attemptMap.set(a.task_id, a);
            });

            // Merge: start from classroom tasks (ensures tasks appear even with 0 submissions)
            const taskMap = new Map<string, any>();
            classroomTasks.forEach(t => taskMap.set(t.id, t));

            // Also include any tasks found only via attempts (edge case: task moved classrooms)
            (attempts || []).forEach((a: any) => {
                if (a.tasks && !taskMap.has(a.tasks.id)) {
                    taskMap.set(a.tasks.id, a.tasks);
                }
            });

            const enriched: EnrichedAssignment[] = Array.from(taskMap.values()).map((task: any) => {
                const attempt = attemptMap.get(task.id);
                return {
                    id: task.id,
                    title: task.title || 'Task',
                    description: task.description || '',
                    due_date: task.due_date || '',
                    file_url: task.file_url,
                    file_name: task.file_name,
                    file_size: task.file_size,
                    // If no attempt yet → show as pending; otherwise use actual status
                    status: attempt?.status || 'pending',
                    score: attempt?.score ?? null,
                    feedback_text: attempt?.feedback_text ?? null,
                    submitted_at: attempt?.submitted_at ?? null,
                };
            });

            // Sort: pending first, then by due date
            enriched.sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime();
            });

            setAssignments(enriched);

            // 4. Fetch Attendance logs
            const { data: att } = await supabaseAuth
                .from('attendance')
                .select('*')
                .eq('student_id', userId)
                .order('date', { ascending: false });
            setAttendance(att || []);

            // Fetch classroom session logs
            if (classroomId) {
                const { data: logs, error: logsErr } = await supabaseAuth
                    .from('classroom_session_logs')
                    .select('*')
                    .eq('classroom_id', classroomId)
                    .order('started_at', { ascending: false });
                if (!logsErr) {
                    setSessionLogs(logs || []);
                }
            }

            // 5. Fetch Messages (Broadcasts) targeted to this student or classroom, joining sender information
            const { data: broadcastsData } = await supabaseAuth
                .from('broadcasts')
                .select('*, sender:users!teacher_id(name, role)')
                .order('created_at', { ascending: false });

            const studentBroadcasts = (broadcastsData || []).filter((b: any) => {
                return b.recipients?.some((r: any) => 
                    (r.type === 'global') ||
                    (r.type === 'student' && r.id === userId) ||
                    (r.type === 'class' && r.id === classroomId)
                );
            });
            setBroadcasts(studentBroadcasts);

            // 6. Fetch Curriculum and Progress data
            const { data: modules } = await supabaseAuth.from('course_modules').select('*').order('module_number', { ascending: true });
            const { data: chapters } = await supabaseAuth.from('course_chapters').select('*').order('chapter_number', { ascending: true });
            const { data: lessons } = await supabaseAuth.from('course_lessons').select('*').order('lesson_number', { ascending: true });
            setCourseModules(modules || []);
            setCourseChapters(chapters || []);
            setCourseLessons(lessons || []);

            const { data: progress } = await supabaseAuth
                .from('student_topic_progress')
                .select('*')
                .eq('student_id', userId);
            setStudentProgress(progress || []);

            if (classroomId) {
                const { data: allocations } = await supabaseAuth
                    .from('classroom_inventory_allocation')
                    .select('*')
                    .eq('classroom_id', classroomId);
                setClassroomInventoryAllocations(allocations || []);
            }

        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        }
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await refreshData();
            setLoading(false);
        };
        init();
    }, [router]);

    // Merged logs for rendering past sessions - placed before conditional early returns
    const mergedLogs = useMemo(() => {
        const logsMap = new Map<string, any>();
        sessionLogs.forEach(log => {
            logsMap.set(log.session_date, log);
        });

        const allDates = new Set<string>([
            ...sessionLogs.map(log => log.session_date),
            ...attendance.map(a => a.date)
        ]);

        const sortedDates = Array.from(allDates).sort((a, b) => b.localeCompare(a));

        return sortedDates.map(dateStr => {
            const log = logsMap.get(dateStr);
            const att = attendance.find(a => a.date === dateStr);
            return {
                date: dateStr,
                id: log?.id || att?.id || dateStr,
                started_at: log?.started_at || null,
                duration_seconds: log?.duration_seconds || null,
                session_type: log?.session_type || null,
                status: att?.status || 'unmarked'
            };
        });
    }, [sessionLogs, attendance]);

    const handleLogout = async () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    // Voice message player helper
    const playVoiceNote = (id: string, audioAttachment: string) => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.onplay = null;
            audioRef.current.onpause = null;
            audioRef.current.ontimeupdate = null;
            audioRef.current.onloadedmetadata = null;
            audioRef.current.onended = null;
        }

        if (playingAudioId === id) {
            setPlayingAudioId(null);
            setIsAudioPaused(false);
            setAudioCurrentTime(0);
            return;
        }

        const audio = new Audio(audioAttachment);
        audio.volume = audioVolume;
        audioRef.current = audio;
        setPlayingAudioId(id);
        setIsAudioPaused(false);

        audio.play().catch(err => {
            console.error('Error playing audio note:', err);
            setPlayingAudioId(null);
        });

        audio.onloadedmetadata = () => {
            setAudioDuration(audio.duration);
        };

        audio.ontimeupdate = () => {
            setAudioCurrentTime(audio.currentTime);
        };

        audio.onplay = () => {
            setIsAudioPaused(false);
        };

        audio.onpause = () => {
            setIsAudioPaused(true);
        };

        audio.onended = () => {
            setPlayingAudioId(null);
            setIsAudioPaused(false);
            setAudioCurrentTime(0);
        };
    };

    const togglePlayback = () => {
        if (!audioRef.current) return;
        if (audioRef.current.paused) {
            audioRef.current.play().catch(err => console.error(err));
        } else {
            audioRef.current.pause();
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return;
        const newTime = parseFloat(e.target.value);
        audioRef.current.currentTime = newTime;
        setAudioCurrentTime(newTime);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setAudioVolume(val);
        if (audioRef.current) {
            audioRef.current.volume = val;
        }
    };

    const formatAudioTime = (secs: number) => {
        if (isNaN(secs) || !isFinite(secs)) return '00:00';
        const mins = Math.floor(secs / 60);
        const remainSecs = Math.floor(secs % 60);
        return `${mins.toString().padStart(2, '0')}:${remainSecs.toString().padStart(2, '0')}`;
    };

    // Toggle lesson completed status
    const handleToggleLessonComplete = async (lessonId: string, currentStatus: string) => {
        if (!profile || !classroom) return;
        
        const nextStatus = currentStatus === 'completed' ? 'unlocked' : 'completed';
        const completedAt = nextStatus === 'completed' ? new Date().toISOString() : null;

        try {
            const { error } = await supabaseAuth
                .from('student_topic_progress')
                .upsert({
                    student_id: profile.id,
                    classroom_id: classroom.id,
                    lesson_id: lessonId,
                    status: nextStatus,
                    unlocked_by: 'student',
                    completed_at: completedAt
                }, { onConflict: 'student_id, lesson_id' });

            if (error) throw error;

            // Update local state
            setStudentProgress(prev => {
                const existing = prev.find(p => p.lesson_id === lessonId);
                if (existing) {
                    return prev.map(p => p.lesson_id === lessonId ? { ...p, status: nextStatus, completed_at: completedAt } : p);
                } else {
                    return [...prev, { student_id: profile.id, classroom_id: classroom.id, lesson_id: lessonId, status: nextStatus, completed_at: completedAt }];
                }
            });
        } catch (err: any) {
            console.error('Error toggling topic progress:', err);
            alert(`Failed to update progress: ${err.message}`);
        }
    };

    // Submit assignment practice video URL
    const handleSubmitTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile || !selectedAssignment || isSubmittingTask) return;

        const videoUrlStr = submitVideoUrl.trim();
        if (!videoUrlStr) {
            alert('Please provide a recording link!');
            return;
        }

        setIsSubmittingTask(true);

        try {
            // Check if there is an existing assignment_students row
            const { data: existingMapping } = await supabaseAuth
                .from('assignment_students')
                .select('*')
                .eq('assignment_id', selectedAssignment.id)
                .eq('student_id', profile.id)
                .maybeSingle();

            let dbError = null;

            if (existingMapping) {
                const { error } = await supabaseAuth
                    .from('assignment_students')
                    .update({
                        status: 'submitted',
                        video_url: videoUrlStr,
                        submitted_at: new Date().toISOString()
                    })
                    .eq('id', existingMapping.id);
                dbError = error;
            } else {
                const { error } = await supabaseAuth
                    .from('assignment_students')
                    .insert({
                        assignment_id: selectedAssignment.id,
                        student_id: profile.id,
                        status: 'submitted',
                        video_url: videoUrlStr,
                        submitted_at: new Date().toISOString()
                    });
                dbError = error;
            }

            if (dbError) throw dbError;

            alert('Practice recording submitted successfully!');

            // Refresh data
            await refreshData();
            
            // Close modal
            setSelectedAssignment(null);
            setSubmitVideoUrl('');
        } catch (err: any) {
            console.error('Error submitting assignment:', err);
            alert(`Failed to submit practice recording: ${err.message}`);
        } finally {
            setIsSubmittingTask(false);
        }
    };

    const handleSubmitExcuse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile || !classroom || isSubmittingExcuse) return;

        const dateStr = excuseDate.trim();
        if (!dateStr) {
            alert('Please select a date!');
            return;
        }

        setIsSubmittingExcuse(true);

        try {
            // 1. Insert attendance record as 'excused'
            const { error: attError } = await supabaseAuth
                .from('attendance')
                .insert({
                    classroom_id: classroom.id,
                    student_id: profile.id,
                    date: dateStr,
                    status: 'excused'
                });

            if (attError) throw attError;

            // 2. Fetch admins to notify
            const { data: admins, error: adminsError } = await supabaseAuth
                .from('users')
                .select('id')
                .eq('role', 'admin');

            if (adminsError) {
                console.error('Error fetching admin users:', adminsError);
            }

            // 3. Prepare notifications for the classroom teacher and all admins
            const notificationTitle = `Excuse Request: ${profile.name}`;
            const notificationMsg = `${profile.name} requested an excuse for class on ${dateStr}.${excuseReason.trim() ? ` Reason: ${excuseReason.trim()}` : ''}`;
            
            const notificationInserts: any[] = [];
            
            // Notification for teacher
            if (classroom.teacher_id) {
                notificationInserts.push({
                    user_id: classroom.teacher_id,
                    title: notificationTitle,
                    message: notificationMsg,
                    type: 'reminder'
                });
            }

            // Notifications for admins
            (admins || []).forEach((adm: any) => {
                if (adm.id !== classroom.teacher_id) { // Avoid duplicate if teacher is also admin
                    notificationInserts.push({
                        user_id: adm.id,
                        title: notificationTitle,
                        message: notificationMsg,
                        type: 'reminder'
                    });
                }
            });

            if (notificationInserts.length > 0) {
                const { error: notifError } = await supabaseAuth
                    .from('notifications')
                    .insert(notificationInserts);
                if (notifError) {
                    console.error('Error writing notifications:', notifError);
                }
            }

            alert('Excuse submitted successfully! Your teacher and admins have been notified.');

            // Refresh local data (re-fetches attendance and updates logs)
            await refreshData();

            // Reset modal state
            setExcuseDate('');
            setExcuseReason('');
            setShowExcuseModal(false);
        } catch (err: any) {
            console.error('Error submitting class excuse:', err);
            alert(`Failed to submit class excuse: ${err.message}`);
        } finally {
            setIsSubmittingExcuse(false);
        }
    };

    // Attendance stats
    const attendanceStats = {
        total: attendance.length,
        present: attendance.filter(a => a.status === 'present').length,
        late: attendance.filter(a => a.status === 'late').length,
        absent: attendance.filter(a => a.status === 'absent').length,
        excused: attendance.filter(a => a.status === 'excused').length,
    };
    const attendancePct = attendanceStats.total > 0
        ? Math.round(((attendanceStats.present + attendanceStats.late) / attendanceStats.total) * 100)
        : null;

    const levelLabel = profile?.level
        ? profile.level.charAt(0).toUpperCase() + profile.level.slice(1)
        : 'Beginner';

    // Curriculum Helper: check lesson status
    const getLessonStatus = (lessonId: string, chapterId: string, moduleId: string): 'locked' | 'unlocked' | 'completed' => {
        const progress = studentProgress.find(p => p.lesson_id === lessonId);
        if (progress) {
            return progress.status as 'locked' | 'unlocked' | 'completed';
        }

        // Check if explicitly unlocked via inventory allocations
        const isAllocated = classroomInventoryAllocations.some(a => 
            (a.lesson_id === lessonId) || 
            (a.chapter_id === chapterId) || 
            (a.module_id === moduleId)
        );

        return isAllocated ? 'unlocked' : 'locked';
    };

    // Calculate completed lessons vs total allocated lessons
    const totalAllocatedLessons = courseLessons.filter(l => 
        classroomInventoryAllocations.some(a => 
            (a.lesson_id === l.id) || 
            (a.chapter_id === l.chapter_id) || 
            (a.module_id === l.module_id)
        )
    ).length;

    const completedLessonsCount = studentProgress.filter(p => p.status === 'completed').length;

    // Find the first unlocked but incomplete lesson to spotlight
    const featuredLesson = useMemo(() => {
        if (courseLessons.length === 0) return null;
        for (const lesson of courseLessons) {
            const status = getLessonStatus(lesson.id, lesson.chapter_id, lesson.module_id);
            if (status === 'unlocked') {
                return lesson;
            }
        }
        // Fallback to first lesson
        return courseLessons[0] || null;
    }, [courseLessons, studentProgress, classroomInventoryAllocations]);

    const completionPct = useMemo(() => {
        const total = totalAllocatedLessons || courseLessons.length || 1;
        return Math.min(100, Math.round((completedLessonsCount / total) * 100));
    }, [completedLessonsCount, totalAllocatedLessons, courseLessons]);

    const recentFeedback = assignments.find(a => a.feedback_text);

    // Track dismissed admin broadcasts in local storage to toggle highlights
    const [dismissedAdminBroadcasts, setDismissedAdminBroadcasts] = useState<string[]>([]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const dismissed = JSON.parse(localStorage.getItem('kfa_dismissed_admin_messages') || '[]');
            setDismissedAdminBroadcasts(dismissed);
        }
    }, []);

    const handleDismissAdminBroadcast = (id: string) => {
        const updated = [...dismissedAdminBroadcasts, id];
        setDismissedAdminBroadcasts(updated);
        localStorage.setItem('kfa_dismissed_admin_messages', JSON.stringify(updated));
    };

    // Calculate unread admin messages
    const unreadAdminBroadcasts = useMemo(() => {
        return broadcasts.filter(b => b.sender?.role === 'admin' && !dismissedAdminBroadcasts.includes(b.id));
    }, [broadcasts, dismissedAdminBroadcasts]);

    if (loading) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8fafc]">
                <Loader2 className="w-10 h-10 animate-spin text-[#d46211] mb-4" />
                <p className="font-semibold text-slate-600 animate-pulse" style={{ fontFamily: 'Lexend, sans-serif' }}>Syncing Academy Files...</p>
            </div>
        );
    }

    if (!classroom) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8fafc] text-center p-6" style={{ fontFamily: 'Lexend, sans-serif' }}>
                <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6 border border-amber-100 shadow-sm">
                    <Clock className="w-12 h-12 text-amber-500" />
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-3 tracking-tight">Account Pending Assignment</h1>
                <p className="text-slate-600 max-w-md font-medium leading-relaxed">
                    Welcome to the Krishna Flute Academy! You have successfully created your account.
                    Please wait for your instructor to assign you to a batch. You will have full access to your curriculum and dashboard once assigned.
                </p>
                <button onClick={handleLogout} className="mt-8 px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2">
                    <LogOut className="w-5 h-5" /> Sign Out
                </button>
            </div>
        );
    }

    return (
        <>
        {showPracticeSuite && (
            <PracticeSuiteModal 
                defaultTab={practiceSuiteTab} 
                onClose={() => setShowPracticeSuite(false)} 
            />
        )}
        
        <div className="flex min-h-screen bg-[#FAF6F0]" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {/* Google Fonts */}
            <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet" />

            {/* Sidebar Overlay Backdrop for Mobile */}
            {mobileSidebarOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}

            {/* Sidebar Navigation */}
            <aside className={`
                w-72 border-r border-[#E6E1DA] bg-white flex flex-col shrink-0 z-40 transition-transform duration-300
                fixed md:sticky top-0 left-0 h-screen
                ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="p-6 flex flex-col justify-center border-b border-slate-150">
                    <h1 className="font-black text-xl leading-tight text-slate-950 select-none">
                        Krishna Flute
                    </h1>
                    <p className="text-xs font-semibold text-[#b45309] mt-0.5 uppercase tracking-wider select-none">
                        Academy Portal
                    </p>
                </div>

                {/* Sidebar Profile Card */}
                <div className="p-4 border-b border-slate-150 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#ecb613]/25 to-amber-50 flex items-center justify-center overflow-hidden border border-slate-100 shadow-xs">
                            {profile?.profile_pic_url ? (
                                <img src={profile.profile_pic_url} alt={profile.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[#d46211] text-base font-extrabold">{profile?.name?.charAt(0)}</span>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-xs text-slate-800 truncate">{profile?.name}</p>
                            <p className="text-[10px] font-semibold text-slate-400 truncate mt-0.5">{profile?.email}</p>
                        </div>
                    </div>
                </div>

                {/* Sidebar Navigation Options */}
                <nav className="p-4 flex-1 space-y-1.5 overflow-y-auto">
                    {[
                        { id: 'overview', label: 'Overview', icon: BarChart2 },
                        { id: 'curriculum', label: 'Curriculum Progress', icon: BookOpen },
                        { id: 'tasks', label: 'Tasks & Submissions', icon: ClipboardList },
                        { id: 'messages', label: 'Message Center', icon: Mail },
                        { id: 'attendance', label: 'Attendance logs', icon: Calendar },
                        { id: 'library', label: 'Library & Tools', icon: FileText },
                    ].map((item) => {
                        const Icon = item.icon;
                        const active = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveTab(item.id as any);
                                    setMobileSidebarOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 py-3 transition-all relative ${
                                    active 
                                        ? 'bg-[#FAF5EE] text-[#7C5E3F] font-black border-l-4 border-[#7C5E3F] pl-3.5 pr-4 rounded-r-2xl' 
                                        : 'text-[#5C5852] hover:bg-[#FAF5EE]/50 hover:text-[#7C5E3F] px-4 rounded-xl'
                                }`}
                            >
                                <Icon className={`w-[22px] h-[22px] shrink-0 ${active ? 'text-[#7C5E3F]' : 'text-slate-400'}`} />
                                <span className="text-sm font-semibold">{item.label}</span>
                                {item.id === 'tasks' && assignments.filter(a => a.status === 'pending').length > 0 && (
                                    <span className="ml-auto w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">
                                        {assignments.filter(a => a.status === 'pending').length}
                                    </span>
                                )}
                                {item.id === 'messages' && (
                                    unreadAdminBroadcasts.length > 0 ? (
                                        <span className="ml-auto flex h-2 w-2 relative shrink-0">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d49900] opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#d49900]"></span>
                                        </span>
                                    ) : broadcasts.length > 0 ? (
                                        <span className="ml-auto w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
                                    ) : null
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Logout Button Footer */}
                <div className="p-4 border-t border-slate-150">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="w-[22px] h-[22px] shrink-0 text-red-500" />
                        <span className="text-sm font-semibold">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-16 bg-[#FAF6F0]/85 backdrop-blur-md border-b border-[#E6E1DA] flex items-center justify-between px-4 sm:px-6 md:px-8 sticky top-0 z-30">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            onClick={() => setMobileSidebarOpen(true)}
                            className="md:hidden p-2 -ml-2 rounded-lg text-slate-700 hover:bg-[#FAF5EE] transition-colors"
                            aria-label="Open Menu"
                        >
                            <Menu className="w-5.5 h-5.5 text-[#5C5852]" />
                        </button>
                        <div className="hidden md:flex text-[#7C5E3F]">
                            <Music className="w-5 h-5" />
                        </div>
                        <h2 className="text-[#3E3A35] font-extrabold tracking-tight capitalize text-sm md:text-base">
                            {activeTab === 'library' ? 'Library & Tools' : activeTab === 'tasks' ? 'Tasks & Submissions' : activeTab}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4 text-[#5C5852]">
                        <button className="p-1.5 hover:bg-[#FAF5EE] rounded-full transition-colors relative">
                            <span className="material-symbols-outlined text-xl">notifications</span>
                            {assignments.filter(a => a.status === 'pending').length > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-[#d49900] rounded-full"></span>
                            )}
                        </button>
                        <button onClick={() => {
                            setPracticeSuiteTab('metronome');
                            setShowPracticeSuite(true);
                        }} className="p-1.5 hover:bg-[#FAF5EE] rounded-full transition-colors">
                            <span className="material-symbols-outlined text-xl">settings</span>
                        </button>

                        <div className="h-6 w-[1px] bg-[#E6E1DA] hidden sm:block"></div>

                        {profile?.profile_pic_url ? (
                            <img src={profile.profile_pic_url} alt={profile.name} className="w-8 h-8 rounded-xl object-cover border border-[#E6E1DA] shadow-xs" />
                        ) : (
                            <div className="w-8 h-8 rounded-xl bg-[#FAF5EE] border border-[#E6E1DA] flex items-center justify-center text-[#7C5E3F] font-bold text-xs">
                                {profile?.name?.charAt(0) || 'S'}
                            </div>
                        )}
                        
                        <button onClick={handleLogout} className="md:hidden text-rose-500 p-2">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 p-3 sm:p-6 md:p-8 w-full max-w-[1400px]">
                    {/* ──── OVERVIEW TAB ──── */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            {/* Admin Broadcast Alert Banner */}
                            {unreadAdminBroadcasts.length > 0 && (
                                <div className="bg-[#FAF5EE] border-l-4 border-[#7C5E3F] rounded-2xl p-4 sm:p-5 shadow-xs flex items-start justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
                                    <div className="flex items-start gap-3 text-left">
                                        <div className="w-9 h-9 rounded-full bg-[#FAF5EE] border border-[#7C5E3F]/20 text-[#7C5E3F] flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="material-symbols-outlined text-lg">campaign</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-[#7C5E3F] uppercase tracking-wider bg-amber-100 dark:bg-amber-950/20 px-2 py-0.5 rounded">Important Notice</span>
                                                <span className="text-[9px] font-bold text-slate-400">
                                                    {new Date(unreadAdminBroadcasts[0].created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <h4 className="font-extrabold text-slate-800 text-sm mt-1 truncate">{unreadAdminBroadcasts[0].subject}</h4>
                                            <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                                {unreadAdminBroadcasts[0].content}
                                            </p>
                                            <button 
                                                onClick={() => setActiveTab('messages')}
                                                className="text-xs font-black text-[#7C5E3F] hover:text-[#5c442c] transition-colors mt-2 flex items-center gap-0.5"
                                            >
                                                Read full announcement <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleDismissAdminBroadcast(unreadAdminBroadcasts[0].id)}
                                        className="text-[#9A958E] hover:text-[#7C5E3F] transition-colors p-1"
                                        aria-label="Dismiss Alert"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            {/* Welcome Banner Card */}
                            <div 
                                className="bg-cover bg-center rounded-3xl relative p-6 sm:p-8 text-white min-h-[240px] md:min-h-[280px] flex items-center shadow-md overflow-hidden border border-[#E6E1DA] text-left"
                                style={{ backgroundImage: "url('/flutes_custom.jpg')" }}
                            >
                                {/* Overlay to ensure text readability */}
                                <div className="absolute inset-0 bg-gradient-to-r from-[#2B1B0E]/95 via-[#2B1B0E]/75 to-transparent pointer-events-none"></div>
                                
                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
                                    <div className="space-y-4 max-w-xl">
                                        <div>
                                            <span className="bg-[#FAF5EE] text-[#7C5E3F] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
                                                ★ Flute Academy Student Portal
                                            </span>
                                        </div>
                                        <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-white">
                                            Namaste, {profile?.name?.split(' ')[0]}!
                                        </h1>
                                        <p className="text-sm font-medium text-slate-200 leading-relaxed italic">
                                            "Daily Practice Tip: Blow gently with a relaxed embouchure. Focus on a clear sound, warm breath support, and precise finger placement."
                                        </p>
                                        
                                        {classroom && (
                                            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-white w-fit text-left shrink-0">
                                                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                                                    <Users className="w-4 h-4 text-amber-350" />
                                                </div>
                                                <div>
                                                    <p className="text-[8px] font-bold text-white/60 uppercase tracking-wider leading-none">Active Batch</p>
                                                    <p className="text-xs font-black mt-0.5">{classroom.name} · {classroom.teacher_name}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-3 w-full sm:w-auto md:w-auto">
                                        <button 
                                            onClick={() => {
                                                setPracticeSuiteTab('metronome');
                                                setShowPracticeSuite(true);
                                            }}
                                            className="px-6 py-3.5 bg-[#d49900] hover:bg-[#b58300] text-white font-extrabold text-xs rounded-full shadow-lg shadow-orange-950/20 hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-2 group w-full sm:w-auto"
                                        >
                                            <PlayCircle className="w-4 h-4" />
                                            Start Practice Room
                                        </button>
                                        <button 
                                            onClick={() => setActiveTab('curriculum')}
                                            className="px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/15 font-extrabold text-xs rounded-full backdrop-blur-md transition-all flex items-center justify-center gap-2 active:scale-98 w-full sm:w-auto"
                                        >
                                            <BookOpen className="w-4 h-4 text-white/80" />
                                            View Syllabus
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Metrics Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Level Card */}
                                <div className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:shadow-sm hover:border-[#7C5E3F]/20 transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/10 transition-colors"></div>
                                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#F5ECE3] text-[#D49E35] flex items-center justify-center shrink-0">
                                        <Award className="w-5.5 h-5.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[9px] sm:text-[10px] font-extrabold text-[#9A958E] uppercase tracking-widest">Proficiency</p>
                                        <h3 className="font-extrabold text-sm sm:text-base text-[#3E3A35] truncate mt-0.5">{levelLabel}</h3>
                                        <p className="text-[9px] sm:text-[10px] font-semibold text-[#9A958E] mt-0.5">Scale & Finger training</p>
                                    </div>
                                </div>

                                {/* Class/Batch Card */}
                                <div className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:shadow-sm hover:border-[#7C5E3F]/20 transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-orange-500/10 transition-colors"></div>
                                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#E3ECF5] text-[#5383B4] flex items-center justify-center shrink-0">
                                        <Clock className="w-5.5 h-5.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[9px] sm:text-[10px] font-extrabold text-[#9A958E] uppercase tracking-widest">My Batch</p>
                                        <h3 className="font-extrabold text-sm sm:text-base text-[#3E3A35] truncate mt-0.5">{classroom?.name || 'Not Enrolled'}</h3>
                                        <p className="text-[9px] sm:text-[10px] font-semibold text-[#9A958E] mt-0.5">Active Class Session</p>
                                    </div>
                                </div>

                                {/* Attendance Percentage */}
                                <div className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:shadow-sm hover:border-[#7C5E3F]/20 transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors"></div>
                                    
                                    {attendancePct !== null ? (
                                        <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center shrink-0">
                                            {/* Circular Progress Ring */}
                                            <svg className="w-full h-full transform -rotate-90">
                                                {/* Background Circle */}
                                                <circle 
                                                    cx="50%" 
                                                    cy="50%" 
                                                    r="40%" 
                                                    strokeWidth="8%" 
                                                    stroke="#f1f5f9" 
                                                    fill="transparent" 
                                                />
                                                {/* Progress Circle */}
                                                <circle 
                                                    cx="50%" 
                                                    cy="50%" 
                                                    r="40%" 
                                                    strokeWidth="8%" 
                                                    stroke="url(#emeraldGradient)" 
                                                    strokeDasharray={`${2 * Math.PI * 40}`}
                                                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - attendancePct / 100)}`}
                                                    strokeLinecap="round"
                                                    fill="transparent" 
                                                />
                                                <defs>
                                                    <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                        <stop offset="0%" stopColor="#10b981" />
                                                        <stop offset="100%" stopColor="#059669" />
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                            <span className="absolute text-[10px] font-black text-emerald-600">{attendancePct}%</span>
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/0 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/10">
                                            <Calendar className="w-5.5 h-5.5" />
                                        </div>
                                    )}
                                    
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[9px] sm:text-[10px] font-extrabold text-[#9A958E] uppercase tracking-widest">Attendance</p>
                                        <h3 className="font-extrabold text-sm sm:text-base text-[#3E3A35] mt-0.5">{attendancePct !== null ? `${attendancePct}%` : '—'}</h3>
                                        <p className="text-[9px] sm:text-[10px] font-semibold text-[#9A958E] mt-0.5">{attendanceStats.total} marked sessions</p>
                                    </div>
                                </div>

                                {/* Pending Tasks count */}
                                <div className="bg-[#FDFBF7] border border-[#E6E1DA] rounded-3xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-2xs hover:shadow-sm hover:border-[#7C5E3F]/20 transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#F5E3E6] rounded-full blur-xl pointer-events-none group-hover:bg-[#F5E3E6]/10 transition-colors"></div>
                                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#F5E3E6] text-[#B45366] flex items-center justify-center shrink-0">
                                        <ClipboardList className="w-5.5 h-5.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[9px] sm:text-[10px] font-extrabold text-[#9A958E] uppercase tracking-widest">Pending Tasks</p>
                                        <h3 className="font-extrabold text-sm sm:text-base text-[#3E3A35] mt-0.5">{assignments.filter(a => a.status === 'pending').length} Tasks</h3>
                                        <p className="text-[9px] sm:text-[10px] font-semibold text-[#9A958E] mt-0.5">Needs practice video</p>
                                    </div>
                                </div>
                            </div>

                            {/* Core Dashboard split sections */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left column: Weekly Curriculum & Recent Submissions */}
                                <div className="lg:col-span-2 space-y-6">
                                    {/* This Week's Curriculum */}
                                    <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-sm text-left">
                                        <div className="px-6 py-5 border-b border-[#E6E1DA] flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center">
                                                    <BookOpen className="w-4.5 h-4.5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-[#3E3A35] text-sm md:text-base">This Week's Curriculum</h3>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">Focus: Mastering the bansuri key scales & alankars</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => setActiveTab('curriculum')} 
                                                className="text-xs font-bold text-[#7C5E3F] hover:text-[#5c442c] transition-colors flex items-center gap-0.5"
                                            >
                                                View Full Syllabus <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <div className="p-6">
                                            {featuredLesson ? (
                                                <div className="space-y-4">
                                                    <div className="p-5 rounded-2xl bg-[#FDFBF7] border border-[#E6E1DA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 transition-all hover:border-[#7C5E3F]/20">
                                                        <div className="min-w-0 flex-1 text-left space-y-3">
                                                            <div>
                                                                <span className="text-[9px] font-extrabold text-[#7C5E3F] bg-[#FAF5EE] px-2.5 py-1 rounded-full uppercase tracking-wider">Spotlight Lesson</span>
                                                                <h4 className="font-black text-base text-[#3E3A35] mt-2 leading-snug">
                                                                    Lesson {featuredLesson.lesson_number}: {featuredLesson.title}
                                                                </h4>
                                                            </div>
                                                            <p className="text-xs text-[#5C5852] line-clamp-2 leading-relaxed">{featuredLesson.description || 'Practice your finger coordination and mouth alignment on your bansuri to perfect your sound projection.'}</p>
                                                            
                                                            <div className="flex items-center gap-2 pt-1 flex-wrap">
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#7C5E3F] bg-[#FAF5EE] px-2.5 py-1 rounded-full">
                                                                    <Clock className="w-3 h-3 text-[#7C5E3F]" /> {featuredLesson.duration || '20 Mins'}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#5383B4] bg-[#E3ECF5] px-2.5 py-1 rounded-full">
                                                                    <Award className="w-3 h-3" /> {featuredLesson.difficulty || 'Intermediate'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="shrink-0 w-full sm:w-auto relative group">
                                                            <img 
                                                                src="/flutes_custom.jpg" 
                                                                alt="Active lesson spotlight" 
                                                                className="object-cover rounded-2xl w-full sm:w-36 h-24 border border-[#E6E1DA]" 
                                                            />
                                                            <div className="absolute inset-0 bg-black/10 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Play className="w-8 h-8 text-white fill-white" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Social Practice Indicator */}
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#E6E1DA]/60">
                                                        <div className="flex -space-x-2 overflow-hidden shrink-0">
                                                            {classmates.slice(0, 3).map((mate, i) => (
                                                                <div key={mate.id} className="inline-block h-6 w-6 rounded-full ring-2 ring-white overflow-hidden bg-slate-100">
                                                                    {mate.profile_pic_url ? (
                                                                        <img src={mate.profile_pic_url} alt={mate.name} className="h-full w-full object-cover" />
                                                                    ) : (
                                                                        <div className="h-full w-full flex items-center justify-center text-[8px] font-bold text-[#7C5E3F] bg-[#FAF5EE]">
                                                                            {mate.name.charAt(0)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            {classmates.length > 3 && (
                                                                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-[#FAF5EE] ring-2 ring-white text-[9px] font-black text-[#7C5E3F]">
                                                                    +{classmates.length - 3}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] font-semibold text-[#9A958E] text-left">
                                                            {classmates.length > 0 ? `${classmates.length + 5} student(s) from your batch are practicing this week` : 'Join the practice room to begin today!'}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-8 border border-dashed border-[#E6E1DA] rounded-2xl text-center bg-slate-50/50">
                                                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                                    <p className="text-xs font-bold text-slate-700">Course completed!</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">Contact your teacher for your next advanced module.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Recent Submissions & Feedback */}
                                    <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-sm text-left">
                                        <div className="px-6 py-5 border-b border-[#E6E1DA] flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center">
                                                    <ClipboardList className="w-4.5 h-4.5" />
                                                </div>
                                                <h3 className="font-black text-[#3E3A35] text-sm md:text-base">Recent Submissions & Feedback</h3>
                                            </div>
                                            <button 
                                                onClick={() => setActiveTab('tasks')} 
                                                className="text-xs font-bold text-[#7C5E3F] hover:text-[#5c442c] transition-colors"
                                            >
                                                View Tasks
                                            </button>
                                        </div>

                                        <div className="p-6">
                                            {assignments.filter(a => a.status !== 'pending').length === 0 ? (
                                                <div className="py-10 border border-dashed border-[#E6E1DA] rounded-2xl text-center bg-slate-50/50">
                                                    <HelpCircle className="w-8 h-8 text-[#9A958E] mx-auto mb-2" />
                                                    <p className="text-xs font-bold text-[#3E3A35]">No submissions yet.</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">Submit your first task attempt to see feedback reports here.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {assignments.filter(a => a.status !== 'pending').slice(0, 2).map((asg) => {
                                                        const isReviewed = asg.status === 'reviewed' || asg.status === 'approved';
                                                        return (
                                                            <div key={asg.id} className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#E6E1DA] hover:border-[#7C5E3F]/15 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                                <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                                                                    <div className="w-10 h-10 rounded-xl bg-[#F7F2EA] text-[#7C5E3F] flex items-center justify-center shrink-0">
                                                                        {isReviewed ? <Award className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <h4 className="font-extrabold text-sm text-[#3E3A35] truncate">{asg.title}</h4>
                                                                        <p className="text-[10px] text-slate-400 mt-1">
                                                                            Submitted {asg.submitted_at ? new Date(asg.submitted_at).toLocaleDateString() : 'recently'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                                                                    {isReviewed ? (
                                                                        <>
                                                                            <span className="bg-[#E3F5EC] border border-[#a3e2c9] text-[#35A47E] font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                                                Reviewed
                                                                            </span>
                                                                            <span className="text-xs font-black text-[#3E3A35]">
                                                                                {asg.score !== null ? `Score: ${asg.score}/10` : 'Grade: Excellent'}
                                                                            </span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <span className="bg-[#FDF6E2] border border-[#f5e1b5] text-[#93702c] font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                                                Under Review
                                                                            </span>
                                                                            <span className="text-[10px] font-semibold text-[#9A958E]">
                                                                                Wait time: ~2 hours
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right column: Quick Tools & Term Progress */}
                                <div className="space-y-6">
                                    {/* Quick Tools */}
                                    <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-sm text-left">
                                        <div className="px-6 py-5 border-b border-[#E6E1DA] flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-lg">construction</span>
                                            </div>
                                            <h3 className="font-black text-[#3E3A35] text-sm md:text-base">Quick Tools</h3>
                                        </div>
                                        
                                        <div className="p-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <button 
                                                    onClick={() => {
                                                        setPracticeSuiteTab('metronome');
                                                        setShowPracticeSuite(true);
                                                    }} 
                                                    className="p-5 rounded-3xl border border-[#E6E1DA] bg-[#FDFBF7] hover:bg-[#FAF5EE] flex flex-col items-center justify-center gap-2.5 transition-all duration-350 group hover:-translate-y-0.5 hover:shadow-xs w-full"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center text-lg font-black group-hover:scale-105 transition-transform">
                                                        M
                                                    </div>
                                                    <span className="text-[11px] font-black text-[#3E3A35] tracking-wide">Metronome</span>
                                                </button>
  
                                                <button 
                                                    onClick={() => {
                                                        setPracticeSuiteTab('metronome');
                                                        setShowPracticeSuite(true);
                                                    }} 
                                                    className="p-5 rounded-3xl border border-[#E6E1DA] bg-[#FDFBF7] hover:bg-[#FAF5EE] flex flex-col items-center justify-center gap-2.5 transition-all duration-350 group hover:-translate-y-0.5 hover:shadow-xs w-full"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center group-hover:scale-105 transition-transform">
                                                        <span className="material-symbols-outlined text-2xl">album</span>
                                                    </div>
                                                    <span className="text-[11px] font-black text-[#3E3A35] tracking-wide">Tanpura</span>
                                                </button>
  
                                                <button 
                                                    onClick={() => {
                                                        setPracticeSuiteTab('drums');
                                                        setShowPracticeSuite(true);
                                                    }} 
                                                    className="p-5 rounded-3xl border border-[#E6E1DA] bg-[#FDFBF7] hover:bg-[#FAF5EE] flex flex-col items-center justify-center gap-2.5 transition-all duration-350 group hover:-translate-y-0.5 hover:shadow-xs w-full"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center group-hover:scale-105 transition-transform">
                                                        <span className="material-symbols-outlined text-2xl">hardware</span>
                                                    </div>
                                                    <span className="text-[11px] font-black text-[#3E3A35] tracking-wide">Tuner</span>
                                                </button>
 
                                                <button 
                                                    onClick={() => setActiveTab('library')}
                                                    className="p-5 rounded-3xl border border-[#E6E1DA] bg-[#FDFBF7] hover:bg-[#FAF5EE] flex flex-col items-center justify-center gap-2.5 transition-all duration-350 group hover:-translate-y-0.5 hover:shadow-xs w-full"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-[#FAF5EE] text-[#7C5E3F] flex items-center justify-center group-hover:scale-105 transition-transform">
                                                        <FileText className="w-5.5 h-5.5 text-[#7C5E3F]" />
                                                    </div>
                                                    <span className="text-[11px] font-black text-[#3E3A35] tracking-wide">Library</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Term Progress */}
                                    <div className="bg-white border border-[#E6E1DA] rounded-3xl overflow-hidden shadow-sm text-left">
                                        <div className="px-6 py-5 border-b border-[#E6E1DA] flex items-center justify-between">
                                            <div>
                                                <h3 className="font-black text-[#3E3A35] text-sm">Term Progress</h3>
                                                <p className="text-[9px] font-extrabold text-[#7C5E3F] uppercase tracking-wider mt-0.5">
                                                    Course: {levelLabel} Level
                                                </p>
                                            </div>
                                        </div>

                                        <div className="p-6 flex flex-col items-center justify-center text-center space-y-6">
                                            {/* Radial SVG Completion Gauge */}
                                            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                                                <svg className="w-full h-full transform -rotate-90">
                                                    {/* Background Circle */}
                                                    <circle 
                                                        cx="50%" 
                                                        cy="50%" 
                                                        r="40%" 
                                                        strokeWidth="8%" 
                                                        stroke="#f1f5f9" 
                                                        fill="transparent" 
                                                    />
                                                    {/* Progress Circle */}
                                                    <circle 
                                                        cx="50%" 
                                                        cy="50%" 
                                                        r="40%" 
                                                        strokeWidth="8%" 
                                                        stroke="#7C5E3F" 
                                                        strokeDasharray={`${2 * Math.PI * 40}`}
                                                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - completionPct / 100)}`}
                                                        strokeLinecap="round"
                                                        fill="transparent" 
                                                    />
                                                </svg>
                                                <div className="absolute flex flex-col items-center justify-center leading-none">
                                                    <span className="text-2xl font-black text-[#3E3A35]">{completionPct}%</span>
                                                    <span className="text-[8px] font-black text-[#9A958E] uppercase tracking-wider mt-1">Completed</span>
                                                </div>
                                            </div>

                                            {/* Attendance Linear bar */}
                                            <div className="w-full text-left space-y-2 pt-2 border-t border-[#E6E1DA]/60">
                                                <div className="flex items-center justify-between text-[11px] font-black text-[#3E3A35]">
                                                    <span>Lessons Attended</span>
                                                    <span>{completedLessonsCount}/{totalAllocatedLessons || courseLessons.length || 10}</span>
                                                </div>
                                                <div className="w-full h-2 bg-[#F1EFEB] rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-[#7C5E3F] rounded-full transition-all duration-500"
                                                        style={{ width: `${completionPct}%` }}
                                                    />
                                                </div>
                                                <p className="text-[10px] font-medium text-[#9A958E] leading-relaxed italic pt-1">
                                                    "You're doing great! Keep up the daily practice to finish the term syllabus."
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ──── CLASSROOM & CURRICULUM TAB ──── */}
                    {activeTab === 'curriculum' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            {/* Classroom Header Summary */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row justify-between gap-6">
                                <div className="space-y-2 max-w-xl text-left">
                                    <span className="bg-orange-50 border border-orange-100 text-orange-600 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">Classroom Hub</span>
                                    <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">{classroom?.name || 'Not Enrolled'}</h2>
                                    <p className="text-xs text-slate-500 leading-relaxed">{classroom?.description || 'Active practice batch directory. Work through dynamic syllabus modules below.'}</p>
                                </div>
                                <div className="border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 flex flex-col justify-center shrink-0 text-left">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Your Instructor</p>
                                    <p className="font-extrabold text-sm text-slate-800 mt-1">{classroom?.teacher_name}</p>
                                    <p className="text-xs text-slate-400">{classroom?.teacher_email}</p>
                                </div>
                            </div>

                            {/* Split layout: classmates on right, curriculum tree on left */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                                {/* Left: Curriculum Syllabus Tree */}
                                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs text-left">
                                    <div className="bg-gradient-to-r from-amber-50 to-orange-50/20 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                                        <div>
                                            <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">Academy Syllabus</h3>
                                            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Allocated lessons. Mark completed to record your learning.</p>
                                        </div>
                                        <div className="bg-amber-500/10 text-amber-700 text-[10px] sm:text-xs font-extrabold px-2.5 sm:px-3 py-1.5 rounded-full shrink-0 ml-2">
                                            Completed: {completedLessonsCount} / {totalAllocatedLessons || courseLessons.length}
                                        </div>
                                    </div>
                                    <div className="p-6">

                                    {courseModules.length === 0 ? (
                                        <div className="py-12 text-center text-slate-400">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-300" />
                                            <p className="text-xs">Loading course modules...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {courseModules.map((module) => {
                                                const isModExpanded = !!expandedModules[module.id];
                                                const chapters = courseChapters.filter(c => c.module_id === module.id);
                                                
                                                return (
                                                    <div key={module.id} className="border border-slate-150 rounded-2xl overflow-hidden transition-all shadow-xs">
                                                        {/* Module Row */}
                                                        <button 
                                                            onClick={() => setExpandedModules(prev => ({ ...prev, [module.id]: !prev[module.id] }))}
                                                            className="w-full flex items-center justify-between px-5 py-4 bg-slate-50/50 hover:bg-slate-50 text-left border-b border-slate-100"
                                                        >
                                                            <div className="min-w-0 flex-1 pr-4">
                                                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Module {module.module_number}</span>
                                                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800 mt-0.5 truncate">{module.title}</h4>
                                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{module.description}</p>
                                                            </div>
                                                            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isModExpanded ? 'rotate-90' : ''}`} />
                                                        </button>

                                                        {/* Module Chapters (Collapsed/Expanded) */}
                                                        {isModExpanded && (
                                                            <div className="p-4 bg-white space-y-3">
                                                                {chapters.length === 0 ? (
                                                                    <p className="text-[10px] text-slate-400 py-2">No chapters published in this module.</p>
                                                                ) : (
                                                                    chapters.map((chapter) => {
                                                                        const isChapExpanded = !!expandedChapters[chapter.id];
                                                                        const lessons = courseLessons.filter(l => l.chapter_id === chapter.id);

                                                                        return (
                                                                            <div key={chapter.id} className="border border-slate-100 rounded-xl overflow-hidden">
                                                                                {/* Chapter Row */}
                                                                                <button
                                                                                    onClick={() => setExpandedChapters(prev => ({ ...prev, [chapter.id]: !prev[chapter.id] }))}
                                                                                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/20 hover:bg-slate-50/60 text-left border-b border-slate-100"
                                                                                >
                                                                                    <div className="min-w-0 flex-1 pr-4">
                                                                                        <h5 className="font-bold text-xs text-slate-800 truncate">Chapter {chapter.chapter_number}: {chapter.title}</h5>
                                                                                    </div>
                                                                                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isChapExpanded ? 'rotate-90' : ''}`} />
                                                                                </button>

                                                                                {/* Chapter Lessons */}
                                                                                {isChapExpanded && (
                                                                                    <div className="p-2 bg-white space-y-1">
                                                                                        {lessons.length === 0 ? (
                                                                                            <p className="text-[10px] text-slate-400 p-2">No lessons published in this chapter.</p>
                                                                                        ) : (
                                                                                            lessons.map((lesson) => {
                                                                                                const status = getLessonStatus(lesson.id, chapter.id, module.id);
                                                                                                const isCompleted = status === 'completed';
                                                                                                const isLocked = status === 'locked';

                                                                                                return (
                                                                                                    <div 
                                                                                                        key={lesson.id}
                                                                                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                                                                                                            isCompleted
                                                                                                                ? 'bg-emerald-50/40 border-emerald-100/50'
                                                                                                                : isLocked
                                                                                                                    ? 'bg-slate-50/30 border-slate-100 opacity-60'
                                                                                                                    : 'bg-white border-slate-100 shadow-2xs'
                                                                                                        }`}
                                                                                                    >
                                                                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                                                                                                isCompleted
                                                                                                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-500'
                                                                                                                    : isLocked
                                                                                                                        ? 'bg-slate-100 border-slate-200 text-slate-400'
                                                                                                                        : 'bg-amber-50 border-amber-100 text-amber-500'
                                                                                                            }`}>
                                                                                                                {isCompleted ? <Check className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                                                                                                            </div>
                                                                                                            <div className="min-w-0 flex-1">
                                                                                                                <h6 className="font-extrabold text-[11px] text-slate-800 truncate">
                                                                                                                    {lesson.lesson_number}. {lesson.title}
                                                                                                                </h6>
                                                                                                                <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                                                                                    {lesson.duration || '5 mins'} · {lesson.difficulty || 'Easy'}
                                                                                                                </p>
                                                                                                            </div>
                                                                                                        </div>

                                                                                                        {/* Mark Completed/Locked state trigger */}
                                                                                                        {isLocked ? (
                                                                                                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md shrink-0">
                                                                                                                Locked
                                                                                                            </span>
                                                                                                        ) : (
                                                                                                            <button
                                                                                                                onClick={() => handleToggleLessonComplete(lesson.id, status)}
                                                                                                                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all shrink-0 ${
                                                                                                                    isCompleted
                                                                                                                        ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                                                                                                                        : 'bg-slate-100 hover:bg-amber-500/10 hover:text-amber-600 text-slate-600 border border-slate-200/50'
                                                                                                                }`}
                                                                                                            >
                                                                                                                {isCompleted ? 'Completed ✓' : 'Mark Complete'}
                                                                                                            </button>
                                                                                                        )}
                                                                                                    </div>
                                                                                                );
                                                                                            })
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    </div>
                                </div>

                                {/* Right: Classmates List */}
                                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs text-left">
                                    <div className="bg-gradient-to-r from-amber-50 to-orange-50/20 px-6 py-5 border-b border-slate-100">
                                        <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                                            <Users className="w-4.5 h-4.5 text-amber-500" />
                                            Batch Classmates ({classmates.length})
                                        </h3>
                                    </div>
                                    <div className="p-6">
                                        {classmates.length === 0 ? (
                                            <div className="py-6 text-center text-slate-400">
                                                <p className="text-xs">No classmates enrolled yet.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {classmates.map((mate) => (
                                                    <div key={mate.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                                                        <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                                                            {mate.profile_pic_url ? (
                                                                <img src={mate.profile_pic_url} alt={mate.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-[#d46211] text-sm font-extrabold">{mate.name.charAt(0)}</span>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h5 className="font-bold text-xs text-slate-800 truncate">{mate.name}</h5>
                                                            <span className="inline-block bg-slate-100 text-slate-500 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase mt-0.5">
                                                                {mate.level}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ──── TASKS & SUBMISSIONS TAB ──── */}
                    {activeTab === 'tasks' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Filter Section Tabs */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <h3 className="font-extrabold text-slate-800 text-base">Assignments</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Practice list assigned by your instructor</p>
                                    </div>
                                </div>

                                {assignments.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400">
                                        <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-xs font-bold text-slate-700">No assignments assigned.</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Your teacher has not uploaded any tasks yet.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {assignments.map((asg) => {
                                            const statusClass = 
                                                asg.status === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                                asg.status === 'reviewed' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                                asg.status === 'submitted' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' :
                                                'bg-amber-50 border-amber-100 text-amber-700';

                                            return (
                                                <div 
                                                    key={asg.id} 
                                                    className="bg-white border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between text-left"
                                                >
                                                    <div>
                                                        <div className="flex justify-between items-start gap-4">
                                                            <h4 className="font-extrabold text-xs md:text-sm text-slate-800 line-clamp-1">{asg.title}</h4>
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 ${statusClass}`}>
                                                                {asg.status === 'submitted' ? 'Submitted (Pending)' : asg.status}
                                                            </span>
                                                        </div>

                                                        <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                                                            {asg.description || 'No detailed instructions.'}
                                                        </p>

                                                        {asg.file_url && (
                                                            <a 
                                                                href={asg.file_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#ecb613] bg-amber-50 border border-amber-100 rounded-md px-2 py-1 mt-3.5 hover:bg-amber-100 transition-colors"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                                {asg.file_name || 'View Attachment'}
                                                            </a>
                                                        )}
                                                    </div>

                                                    <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between gap-4">
                                                        <span className="text-[10px] text-slate-400 font-semibold">
                                                            {asg.due_date ? `Due: ${new Date(asg.due_date).toLocaleDateString()}` : 'No due date'}
                                                        </span>

                                                        <button 
                                                            onClick={() => {
                                                                setSelectedAssignment(asg);
                                                                setSubmitVideoUrl(asg.video_url || '');
                                                            }}
                                                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 ${
                                                                asg.status === 'approved' || asg.status === 'reviewed'
                                                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-2xs'
                                                            }`}
                                                        >
                                                            <Video className="w-3.5 h-3.5" />
                                                            {asg.status === 'pending' ? 'Submit' : 'Update'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ──── MESSAGES TAB ──── */}
                    {activeTab === 'messages' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                                <h3 className="font-extrabold text-slate-800 text-base mb-1">Message Center</h3>
                                <p className="text-xs text-slate-500 mb-6">Timeline of announcements and practice alerts sent by the teacher</p>

                                {broadcasts.length === 0 ? (
                                    <div className="py-12 border border-dashed border-slate-100 rounded-2xl text-center bg-slate-50/50">
                                        <Mail className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-slate-700">Inbox empty.</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">You don't have any messages yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {broadcasts.map((b) => {
                                            const isAdmin = b.sender?.role === 'admin';
                                            return (
                                                <div 
                                                    key={b.id} 
                                                    className={`transition-all flex flex-col justify-between gap-4 text-left p-5 rounded-2xl ${
                                                        isAdmin 
                                                            ? 'bg-[#FAF5EE]/70 border-2 border-[#7C5E3F]/35 hover:bg-[#FAF5EE]/90 shadow-xs' 
                                                            : 'bg-slate-50/40 border border-slate-150 hover:bg-slate-50/80 shadow-2xs'
                                                    }`}
                                                >
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">{b.subject}</h4>
                                                                {isAdmin && (
                                                                    <span className="inline-flex items-center gap-1 text-[8px] font-black text-[#7C5E3F] bg-amber-100 px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                                                                        📢 Admin Notice
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="inline-block text-[8px] font-black text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 mt-1 uppercase tracking-wider">
                                                                Channel: {b.channel}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                                                            {new Date(b.created_at).toLocaleDateString()} at {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-slate-655 leading-relaxed whitespace-pre-wrap">
                                                        {b.content}
                                                    </p>

                                                    {/* Audio Note attachment */}
                                                    {b.audio_attachment && (
                                                        <div className="pt-2">
                                                            <button 
                                                                onClick={() => playVoiceNote(b.id, b.audio_attachment!)}
                                                                className={`inline-flex items-center gap-2 px-4 py-2 border rounded-full text-xs font-extrabold transition-all shadow-2xs ${
                                                                    playingAudioId === b.id 
                                                                        ? 'bg-amber-500 text-white border-amber-600'
                                                                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                                                                }`}
                                                            >
                                                                {playingAudioId === b.id ? (
                                                                    <>
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                        Playing Audio...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                                                                        Listen to Voice Note / Flute Tone
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ──── ATTENDANCE TAB ──── */}
                    {activeTab === 'attendance' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Attendance statistics */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-2 border-b border-slate-100">
                                    <div>
                                        <h3 className="font-extrabold text-slate-800 text-base mb-1">Attendance Tracker</h3>
                                        <p className="text-xs text-slate-500">Total attendance stats and class record history</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setShowExcuseModal(true)}
                                        className="px-5 py-2.5 bg-[#7C5E3F] hover:bg-[#634a31] text-white text-xs font-bold rounded-full flex items-center justify-center gap-2 shadow-xs transition-all hover:scale-102 active:scale-98"
                                    >
                                        <span className="material-symbols-outlined text-sm">event_busy</span>
                                        Inform Absence / Request Excuse
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 text-center shrink-0">
                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">Present</span>
                                        <h4 className="font-extrabold text-xl text-slate-800 mt-1">{attendanceStats.present} Classes</h4>
                                    </div>
                                    <div className="bg-amber-50/50 border border-amber-100/50 rounded-2xl p-4 text-center shrink-0">
                                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block">Late</span>
                                        <h4 className="font-extrabold text-xl text-slate-800 mt-1">{attendanceStats.late} Classes</h4>
                                    </div>
                                    <div className="bg-rose-50/50 border border-rose-100/50 rounded-2xl p-4 text-center shrink-0">
                                        <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest block">Absent</span>
                                        <h4 className="font-extrabold text-xl text-slate-800 mt-1">{attendanceStats.absent} Classes</h4>
                                    </div>
                                    <div className="bg-blue-50/50 border border-blue-100/50 rounded-2xl p-4 text-center shrink-0">
                                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block">Excused</span>
                                        <h4 className="font-extrabold text-xl text-slate-800 mt-1">{attendanceStats.excused} Classes</h4>
                                    </div>
                                </div>

                                {mergedLogs.length === 0 ? (
                                    <div className="py-12 border border-dashed border-slate-100 rounded-2xl text-center bg-slate-50/50">
                                        <Calendar className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-slate-700">No classroom logs found.</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Your teacher has not logged any classroom sessions yet.</p>
                                    </div>
                                ) : (
                                    <div className="border border-slate-150 rounded-2xl overflow-hidden">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 text-left border-b border-slate-150">
                                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Start Time</th>
                                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Class Type</th>
                                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</th>
                                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">My Attendance</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {mergedLogs.map((row) => {
                                                    const badgeClass =
                                                        row.status === 'present' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        row.status === 'late' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        row.status === 'absent' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                        row.status === 'excused' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        'bg-slate-50 text-slate-500 border-slate-200';

                                                    const formattedDate = row.started_at
                                                        ? new Date(row.started_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                                                        : new Date(row.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                                    
                                                    const formattedTime = row.started_at
                                                        ? new Date(row.started_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                                        : null;

                                                    let durationStr = '—';
                                                    if (row.duration_seconds !== null) {
                                                        const durationMins = Math.floor(row.duration_seconds / 60);
                                                        const durationHrs = Math.floor(durationMins / 60);
                                                        const remMins = durationMins % 60;
                                                        durationStr = durationHrs > 0 
                                                            ? `${durationHrs}h ${remMins}m`
                                                            : `${durationMins} min${durationMins !== 1 ? 's' : ''}`;
                                                    }

                                                    return (
                                                        <tr key={row.id} className="hover:bg-slate-50/30">
                                                            <td className="px-5 py-3.5 text-xs font-bold text-slate-800">
                                                                <div>{formattedDate}</div>
                                                                {formattedTime && (
                                                                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5">at {formattedTime}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-3.5 text-xs">
                                                                {row.session_type === 'online' ? (
                                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full font-black text-[9px] uppercase tracking-wider">
                                                                        Online Video Class
                                                                    </span>
                                                                ) : row.session_type === 'offline' ? (
                                                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full font-black text-[9px] uppercase tracking-wider">
                                                                        In-Person Class
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-full font-black text-[9px] uppercase tracking-wider">
                                                                        Manual Entry
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-3.5 text-xs font-bold text-slate-600">
                                                                {durationStr}
                                                            </td>
                                                            <td className="px-5 py-3.5">
                                                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${badgeClass}`}>
                                                                    {row.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ──── LIBRARY & TOOLS TAB ──── */}
                    {activeTab === 'library' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Class Notes board */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                                <h3 className="font-extrabold text-slate-800 text-base mb-1">Class Notes & Materials</h3>
                                <p className="text-xs text-slate-500 mb-6">Resources and reference material uploaded by your instructor</p>

                                {classNotes.length === 0 ? (
                                    <div className="py-12 border border-dashed border-slate-100 rounded-2xl text-center bg-slate-50/50">
                                        <FileText className="w-10 h-10 text-slate-350 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-slate-700">No notes found.</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Your teacher has not posted class notes yet.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                                        {classNotes.map((note) => {
                                            // Dynamic note color styling
                                            const bgClass =
                                                note.color === 'blue' ? 'bg-blue-50/50 border-blue-105/50' :
                                                note.color === 'green' ? 'bg-emerald-50/50 border-emerald-105/50' :
                                                note.color === 'rose' ? 'bg-rose-50/50 border-rose-105/50' :
                                                'bg-amber-50/40 border-amber-105/40';

                                            return (
                                                <div 
                                                    key={note.id} 
                                                    className={`border rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between gap-4 text-left ${bgClass}`}
                                                >
                                                    <div>
                                                        <h4 className="font-extrabold text-xs md:text-sm text-slate-800">{note.title}</h4>
                                                        <p className="text-[11px] text-slate-500 mt-2 line-clamp-4 leading-relaxed whitespace-pre-wrap">
                                                            {note.content}
                                                        </p>
                                                    </div>

                                                    <div className="pt-3 border-t border-slate-150/40 flex items-center justify-between">
                                                        <span className="text-[8px] font-bold text-slate-400">
                                                            {new Date(note.created_at).toLocaleDateString()}
                                                        </span>

                                                        {note.file_url && (
                                                            <a 
                                                                href={note.file_url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-white border border-slate-200 px-2 py-1 rounded-md hover:bg-slate-50 transition-colors"
                                                            >
                                                                <Download className="w-3 h-3" /> Download
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Practice Tools */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-left">
                                <h3 className="font-extrabold text-slate-800 text-base mb-1">Practice Tools</h3>
                                <p className="text-xs text-slate-500 mb-6">Interactive instruments to support your flute rehearsal sessions</p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between items-start gap-4 bg-slate-50/20">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 border border-amber-100">
                                                <Volume2 className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">Practice Metronome</h4>
                                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                                    Keep perfect time with speed adjustments, custom beats, subdivisions, and ramp acceleration modes.
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setPracticeSuiteTab('metronome');
                                                setShowPracticeSuite(true);
                                            }}
                                            className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-colors mt-2"
                                        >
                                            Open Metronome
                                        </button>
                                    </div>
 
                                    <div className="border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between items-start gap-4 bg-slate-50/20">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#d46211] flex items-center justify-center shrink-0 border border-orange-100">
                                                <Music className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">Tanpura Drone</h4>
                                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                                    A plucked Indian classical string drone to align your shruti (pitch scales) and tune your flute.
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setPracticeSuiteTab('metronome');
                                                setShowPracticeSuite(true);
                                            }}
                                            className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-colors mt-2"
                                        >
                                            Open Tanpura
                                        </button>
                                    </div>
 
                                    <div className="border border-slate-150 rounded-2xl p-5 hover:shadow-xs transition-shadow flex flex-col justify-between items-start gap-4 bg-slate-50/20">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-[#d46211]/10 text-[#d46211] flex items-center justify-center shrink-0 border border-[#d46211]/20">
                                                <span className="material-symbols-outlined text-xl font-bold">album</span>
                                            </div>
                                            <div className="text-left">
                                                <h4 className="font-extrabold text-xs md:text-sm text-slate-800">Drum Beats Sequencer</h4>
                                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                                    An interactive step sequencer featuring synthesized Kick, Snare, Hi-hat, and Shaker drums to practice flute play-along grooves.
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setPracticeSuiteTab('drums');
                                                setShowPracticeSuite(true);
                                            }}
                                            className="px-4 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition-colors mt-2"
                                        >
                                            Open Drum Beats
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Submit Recording Draw Drawer Modal */}
            {selectedAssignment && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
                            <div>
                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block">Submit Practice Recording</span>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 line-clamp-1">{selectedAssignment.title}</h3>
                            </div>
                            <button 
                                onClick={() => {
                                    setSelectedAssignment(null);
                                    setSubmitVideoUrl('');
                                }} 
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmitTask} className="p-6 space-y-4">
                            <div className="space-y-1 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Assignment Brief</h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3 mt-1">
                                    {selectedAssignment.description || 'No instruction notes provided by the teacher.'}
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="video-url" className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Video / Recording Link</label>
                                <input 
                                    id="video-url"
                                    type="url"
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#ecb613] font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-405"
                                    placeholder="e.g., YouTube, Google Drive, Soundcloud, or Vimeo link"
                                    value={submitVideoUrl}
                                    onChange={(e) => setSubmitVideoUrl(e.target.value)}
                                    required
                                />
                                <p className="text-[9px] text-slate-400 mt-1">
                                    Upload your practice recording to Drive or YouTube (unlisted) and paste the link here.
                                </p>
                            </div>

                            {/* Existing Grade summary inside drawer */}
                            {(selectedAssignment.score !== undefined && selectedAssignment.score !== null) && (
                                <div className="p-4 bg-emerald-50/40 border border-emerald-100/50 rounded-2xl space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest">Graded Assessment</span>
                                        <span className="font-extrabold text-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Score: {selectedAssignment.score}/10</span>
                                    </div>
                                    {selectedAssignment.feedback_text && (
                                        <p className="text-[11px] text-slate-600 leading-relaxed italic">
                                            "{selectedAssignment.feedback_text}"
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Footer / actions */}
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setSelectedAssignment(null);
                                        setSubmitVideoUrl('');
                                    }}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmittingTask}
                                    className="px-5 py-2 bg-[#ecb613] hover:bg-[#d49f0e] text-slate-900 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:bg-stone-300 disabled:text-slate-500 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    {isSubmittingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                                    {selectedAssignment.status === 'pending' ? 'Submit Recording' : 'Resubmit Recording'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Request Excuse Modal */}
            {showExcuseModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-left">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850/40">
                            <div>
                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block">Class Leave Request</span>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">Inform Absence / Request Excuse</h3>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowExcuseModal(false);
                                    setExcuseDate('');
                                    setExcuseReason('');
                                }} 
                                className="p-1 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        
                        {/* Form */}
                        <form onSubmit={handleSubmitExcuse} className="p-6 space-y-4">
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Informing your teacher and academy admin in advance helps us reschedule classes. Submitting this request logs an <strong>Excused Absence</strong> and makes you eligible for a makeup/alternative slot.
                            </p>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-[#7C5E3F] uppercase tracking-wider pl-1">Absence Date *</label>
                                <input 
                                    type="date"
                                    required
                                    value={excuseDate}
                                    onChange={(e) => setExcuseDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#7C5E3F]/20 outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-[#7C5E3F] uppercase tracking-wider pl-1">Reason / Notes</label>
                                <textarea
                                    value={excuseReason}
                                    onChange={(e) => setExcuseReason(e.target.value)}
                                    rows={3}
                                    placeholder="Explain your plan or reason (e.g. exams, travel, unwell)..."
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#7C5E3F]/20 outline-none transition-all resize-none"
                                />
                            </div>

                            {/* Footer / Actions */}
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setShowExcuseModal(false);
                                        setExcuseDate('');
                                        setExcuseReason('');
                                    }}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-350 text-xs font-bold rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmittingExcuse}
                                    className="px-5 py-2 bg-[#7C5E3F] hover:bg-[#634a31] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:bg-stone-300 disabled:text-slate-500 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    {isSubmittingExcuse ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="material-symbols-outlined text-sm">send</span>}
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Floating Audio Player Bar */}
            {playingAudioId && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-[#E6E1DA] rounded-full py-3 px-6 shadow-xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-10 duration-300">
                    {/* Left: Play status & metadata */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button 
                            type="button"
                            onClick={togglePlayback}
                            className="w-10 h-10 rounded-full bg-[#7C5E3F] text-white hover:bg-[#634a31] flex items-center justify-center shrink-0 shadow-md transition-colors"
                        >
                            {isAudioPaused ? (
                                <Play className="w-4 h-4 fill-white translate-x-0.5" />
                            ) : (
                                <span className="material-symbols-outlined text-lg">pause</span>
                            )}
                        </button>
                        <div className="min-w-0 text-left">
                            <p className="text-[8px] font-extrabold text-[#7C5E3F] uppercase tracking-widest leading-none">Now Practicing</p>
                            <h4 className="text-xs font-black text-[#3E3A35] truncate mt-1">
                                {broadcasts.find(b => b.id === playingAudioId)?.subject || 'Bansuri Audio Rehearsal'}
                            </h4>
                        </div>
                    </div>

                    {/* Center: Seek Timeline */}
                    <div className="hidden sm:flex items-center gap-3 flex-2 px-4 w-full">
                        <span className="text-[9px] font-bold text-slate-400 shrink-0">
                            {formatAudioTime(audioCurrentTime)}
                        </span>
                        <input 
                            type="range"
                            min={0}
                            max={audioDuration || 100}
                            value={audioCurrentTime}
                            onChange={handleSeek}
                            className="w-full h-1 bg-[#F1EFEB] hover:bg-[#E6E1DA] rounded-lg appearance-none cursor-pointer accent-[#7C5E3F] transition-all"
                        />
                        <span className="text-[9px] font-bold text-slate-400 shrink-0">
                            {formatAudioTime(audioDuration)}
                        </span>
                    </div>

                    {/* Right: volume controls */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="material-symbols-outlined text-[#7C5E3F] text-lg select-none">
                            {audioVolume === 0 ? 'volume_off' : audioVolume < 0.5 ? 'volume_down' : 'volume_up'}
                        </span>
                        <input 
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={audioVolume}
                            onChange={handleVolumeChange}
                            className="w-16 h-1 bg-[#E6E1DA] rounded-lg appearance-none cursor-pointer accent-[#7C5E3F]"
                        />
                        <button 
                            type="button"
                            onClick={() => {
                                if (audioRef.current) {
                                    audioRef.current.pause();
                                }
                                setPlayingAudioId(null);
                                setIsAudioPaused(false);
                            }}
                            className="p-1 text-[#9A958E] hover:text-[#7C5E3F] transition-colors ml-1"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
        </>
    );
}
