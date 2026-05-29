'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseAuth } from '../../../../src/lib/supabase-auth';
import { Loader2, ArrowLeft, Search, Bell, HelpCircle, Users, Mail, Video, TrendingUp, Zap, Star, MoreVertical, Lightbulb, Edit3, PlusCircle, FileUp, Plus, Clock, Trash2, Calendar, GripVertical, CheckCircle, Circle, FileText, Film, Lock, Music, UserPlus, AlertTriangle, Sparkles, BarChart2, X, BookOpen, Upload, StickyNote, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Filter, Tag, User, UsersRound, Paperclip, Send, NotebookPen, ClipboardList, Download } from 'lucide-react';
import Link from 'next/link';
import TeacherSidebar from '../../../../src/components/TeacherSidebar';

interface ClassroomDetails {
    id: string;
    name: string;
    description: string;
    status: string;
    created_at: string;
}

interface ScheduleEntry {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
}

interface EnrolledStudent {
    id: string; // classroom_students ID
    student_id: string; // real user ID
    name: string;
    profile_pic_url: string | null;
    joined_at: string;
    // Mock metrics for UI
    mock_score: number;
    mock_progress: number;
    mock_attendance: number;
    mock_milestone: string;
    mock_status: 'Consistent' | 'Improving' | 'At Risk';
}

// Lightweight record from the teacher's student directory
interface DirectoryStudent {
    id: string;
    name: string;
    profile_pic_url: string | null;
    status: string;
}

interface ClassNote {
    id: string;
    classroom_id: string;
    teacher_id: string;
    title: string;
    content: string | null;
    file_url: string | null;
    file_name: string | null;
    file_size: number | null;
    color: string;
    created_at: string;
    updated_at: string;
}

interface Assignment {
    id: string;
    classroom_id: string;
    teacher_id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    target_type: 'all' | 'individual';
    file_url: string | null;
    file_name: string | null;
    file_size: number | null;
    created_at: string;
    // inventory reference (set when assigned from Inventory Library)
    inventory_ref_type?: 'module' | 'chapter' | 'lesson' | null;
    inventory_ref_id?: string | null;
    inventory_ref_title?: string | null;
    // joined
    assignment_students?: AssignmentStudent[];
}

interface AssignmentStudent {
    id: string;
    assignment_id: string;
    student_id: string;
    status: 'pending' | 'submitted' | 'reviewed';
    // joined
    student_name?: string;
    student_pic?: string | null;
}

export default function ClassroomDashboardPage() {
    const router = useRouter();
    const params = useParams();
    const classroomId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<{ id: string; name: string; email: string } | null>(null);
    const [classroom, setClassroom] = useState<ClassroomDetails | null>(null);
    const [students, setStudents] = useState<EnrolledStudent[]>([]);
    const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
    const [activeTab, setActiveTab] = useState('Overview');
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 10;

    // New schedule form state
    const [newSchedule, setNewSchedule] = useState({
        day: 0,
        start: '09:00',
        end: '10:30'
    });
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);

    // ── Add-from-Directory modal ──────────────────────────────────────────────
    const [showDirectoryModal, setShowDirectoryModal] = useState(false);
    const [directoryStudents, setDirectoryStudents] = useState<DirectoryStudent[]>([]);
    const [directorySearch, setDirectorySearch] = useState('');
    const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
    const [isAddingStudents, setIsAddingStudents] = useState(false);
    const [directoryLoading, setDirectoryLoading] = useState(false);

    // ── Remove-from-class ─────────────────────────────────────────────────────
    const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);

    // ── Classroom metadata edit ───────────────────────────────────────────────
    const [metadataForm, setMetadataForm] = useState({ name: '', description: '', status: 'active' });
    const [isSavingMetadata, setIsSavingMetadata] = useState(false);
    const [metadataSaved, setMetadataSaved] = useState(false);
    const [metadataError, setMetadataError] = useState('');

    // ── Assignments ───────────────────────────────────────────────────────────
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [assignmentsLoading, setAssignmentsLoading] = useState(false);
    const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
    const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'all_students' | 'individual'>('all');
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [isSavingAssignment, setIsSavingAssignment] = useState(false);
    const [assignmentForm, setAssignmentForm] = useState({
        title: '',
        description: '',
        due_date: '',
        target_type: 'all' as 'all' | 'individual',
        selectedStudentIds: new Set<string>(),
        file_url: null as string | null,
        file_name: null as string | null,
        file_size: null as number | null,
    });
    const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
    const [deletingAssignmentId, setDeletingAssignmentId] = useState<string | null>(null);
    const assignmentFileRef = useRef<HTMLInputElement>(null);
    const [isDraggingOverAssignments, setIsDraggingOverAssignments] = useState(false);

    const closeAssignmentModal = () => {
        setShowAssignmentModal(false);
        setAssignmentForm({
            title: '',
            description: '',
            due_date: '',
            target_type: 'all',
            selectedStudentIds: new Set<string>(),
            file_url: null,
            file_name: null,
            file_size: null,
        });
        setAssignmentFile(null);
        setAssignmentError('');
    };

    const handleDragStart = (e: React.DragEvent, note: ClassNote) => {
        e.dataTransfer.setData('application/json', JSON.stringify(note));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDropNote = (e: React.DragEvent) => {
        e.preventDefault();
        try {
            const noteData = e.dataTransfer.getData('application/json');
            if (noteData) {
                const note = JSON.parse(noteData) as ClassNote;
                setAssignmentForm({
                    title: note.title,
                    description: note.content || '',
                    due_date: '',
                    target_type: 'all',
                    selectedStudentIds: new Set<string>(),
                    file_url: note.file_url || null,
                    file_name: note.file_name || null,
                    file_size: note.file_size || null,
                });
                setAssignmentFile(null);
                setShowAssignmentModal(true);
            }
        } catch (err) {
            console.error('Error parsing dropped note data:', err);
        }
    };

    // ── Class Notes Board ─────────────────────────────────────────────────────
    const [classNotes, setClassNotes] = useState<ClassNote[]>([]);
    const [notesLoading, setNotesLoading] = useState(false);
    const [showNoteEditor, setShowNoteEditor] = useState(false);
    const [editingNote, setEditingNote] = useState<ClassNote | null>(null);
    const [noteForm, setNoteForm] = useState({ title: '', content: '', color: 'yellow' });
    const [noteFile, setNoteFile] = useState<File | null>(null);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
    const noteFileRef = useRef<HTMLInputElement>(null);

    // ── Attendance Tab State ──────────────────────────────────────────────────
    const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'absent' | 'late' | 'excused'>>({});
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [isSavingAttendanceMap, setIsSavingAttendanceMap] = useState<Record<string, boolean>>({});

    // ── Error states ──────────────────────────────────────────────────────────
    const [dbSetupError, setDbSetupError] = useState(false); // tables not created yet
    const [assignmentError, setAssignmentError] = useState('');
    const [noteError, setNoteError] = useState('');

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

    useEffect(() => {
        const fetchData = async () => {
            if (!classroomId) return;
            setLoading(true);
            try {
                // 1. Authenticate
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

                // 3. Fetch Classroom
                const { data: roomData, error: roomError } = await supabaseAuth
                    .from('classrooms')
                    .select('*')
                    .eq('id', classroomId)
                    .eq('teacher_id', profile.id)
                    .single();
                
                if (roomError) throw roomError;
                const classroomData = { ...roomData, status: roomData.status || 'active' };
                setClassroom(classroomData);
                // Seed the metadata form with fetched values
                setMetadataForm({
                    name: roomData.name || '',
                    description: roomData.description || '',
                    status: roomData.status || 'active',
                });

                // 4. Fetch Enrolled Students
                const { data: roster, error: rosterError } = await supabaseAuth
                    .from('classroom_students')
                    .select(`
                        id,
                        student_id,
                        joined_at,
                        users!student_id(name, profile_pic_url)
                    `)
                    .eq('classroom_id', classroomId);

                if (rosterError) throw rosterError;

                // 5. Build Enrolled Students with Mock metrics for the UI
                const statusOptions: ('Consistent' | 'Improving' | 'At Risk')[] = ['Consistent', 'Improving', 'At Risk'];
                const milestoneOptions = ['Alankars Mastery', 'Breath Control II', 'Fingering Basics', 'Rhythm Training', 'Raag Yaman Intros'];
                
                const formattedRoster = (roster || []).map((r: any, idx) => {
                    const seed = parseInt(r.id.substring(0, 8), 16) || idx; // Pseudo-random determinism
                    return {
                        id: r.id,
                        student_id: r.student_id,
                        name: r.users?.name || 'Unknown',
                        profile_pic_url: r.users?.profile_pic_url || null,
                        joined_at: r.joined_at,
                        mock_score: 6 + ((seed % 40) / 10), // 6.0 to 9.9
                        mock_progress: 50 + (seed % 50), // 50 to 99
                        mock_attendance: 70 + (seed % 30), // 70 to 99
                        mock_milestone: milestoneOptions[seed % milestoneOptions.length],
                        mock_status: idx % 3 === 0 ? 'Consistent' : (idx % 2 === 0 ? 'Improving' : 'At Risk') as any
                    };
                });

                setStudents(formattedRoster);

                // 6. Fetch Schedules
                const { data: scheduleData } = await supabaseAuth
                    .from('batch_schedules')
                    .select('*')
                    .eq('classroom_id', classroomId)
                    .order('day_of_week', { ascending: true })
                    .order('start_time', { ascending: true });
                
                setSchedules(scheduleData || []);

            } catch (err) {
                console.error('Error fetching classroom data:', err);
                router.push('/teacher-dashboard/classrooms');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [classroomId, router]);

    // ── Fetch Assignments ──────────────────────────────────────────────────────
    const fetchAssignments = useCallback(async () => {
        if (!classroomId) return;
        setAssignmentsLoading(true);
        setDbSetupError(false);
        try {
            const { data: asgData, error } = await supabaseAuth
                .from('assignments')
                .select('*')
                .eq('classroom_id', classroomId)
                .order('created_at', { ascending: false });

            if (error) {
                // Log full details — Supabase error objects have non-enumerable props
                console.error('Error fetching assignments — code:', error.code, '| msg:', error.message, '| details:', error.details, '| hint:', error.hint);
                // ANY error here means the table doesn\'t exist or is misconfigured
                setDbSetupError(true);
                return;
            }

            // For each individual assignment, fetch assignment_students
            const enriched = await Promise.all((asgData || []).map(async (a: Assignment) => {
                if (a.target_type === 'individual') {
                    const { data: asData } = await supabaseAuth
                        .from('assignment_students')
                        .select('*')
                        .eq('assignment_id', a.id);
                    // Enrich with student names from the loaded students list
                    const enrichedStudents = (asData || []).map((as: AssignmentStudent) => {
                        const match = students.find(s => s.student_id === as.student_id);
                        return { ...as, student_name: match?.name || 'Unknown', student_pic: match?.profile_pic_url || null };
                    });
                    return { ...a, assignment_students: enrichedStudents };
                }
                return { ...a, assignment_students: [] };
            }));

            setAssignments(enriched);
        } catch (err: any) {
            console.error('Error fetching assignments (exception):', err?.message || err);
            setDbSetupError(true);
        } finally {
            setAssignmentsLoading(false);
        }
    }, [classroomId, students]);

    // ── Fetch Class Notes ──────────────────────────────────────────────────────
    const fetchClassNotes = useCallback(async () => {
        if (!classroomId) return;
        setNotesLoading(true);
        try {
            const { data, error } = await supabaseAuth
                .from('class_notes')
                .select('*')
                .eq('classroom_id', classroomId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching class notes — code:', error.code, '| msg:', error.message);
                // Don\'t double-set dbSetupError; fetchAssignments handles it first
                if (!assignments.length) setDbSetupError(true);
                return;
            }
            setClassNotes(data || []);
        } catch (err: any) {
            console.error('Error fetching class notes (exception):', err?.message || err);
        } finally {
            setNotesLoading(false);
        }
    }, [classroomId, assignments.length]);

    // Fetch when switching to Assignments tab
    useEffect(() => {
        if (activeTab === 'Assignments') {
            fetchAssignments();
            fetchClassNotes();
        }
    }, [activeTab, fetchAssignments, fetchClassNotes]);

    // ── Fetch Classroom Attendance ─────────────────────────────────────────────
    const fetchClassroomAttendance = useCallback(async () => {
        if (!classroomId) return;
        setAttendanceLoading(true);
        try {
            const { data, error } = await supabaseAuth
                .from('attendance')
                .select('student_id, status')
                .eq('classroom_id', classroomId)
                .eq('date', attendanceDate);

            if (error) {
                console.error('Error fetching classroom attendance:', error.message || error);
                return;
            }

            const recordsMap: Record<string, 'present' | 'absent' | 'late' | 'excused'> = {};
            (data || []).forEach((row: any) => {
                recordsMap[row.student_id] = row.status;
            });
            setAttendanceRecords(recordsMap);
        } catch (err: any) {
            console.error('Error fetching classroom attendance (exception):', err?.message || err);
        } finally {
            setAttendanceLoading(false);
        }
    }, [classroomId, attendanceDate]);

    // Fetch when switching to Attendance tab or when attendanceDate changes
    useEffect(() => {
        if (activeTab === 'Attendance') {
            fetchClassroomAttendance();
        }
    }, [activeTab, attendanceDate, fetchClassroomAttendance]);

    // ── Mark Classroom Attendance Handler ──────────────────────────────────────
    const handleMarkClassroomAttendance = async (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
        if (!classroomId || !teacherProfile) return;

        // Optimistically update status
        setAttendanceRecords(prev => ({ ...prev, [studentId]: status }));
        setIsSavingAttendanceMap(prev => ({ ...prev, [studentId]: true }));

        try {
            const { error } = await supabaseAuth
                .from('attendance')
                .upsert({
                    student_id: studentId,
                    classroom_id: classroomId,
                    date: attendanceDate,
                    status: (status as string).toLowerCase(),
                    marked_by: teacherProfile.id
                }, { onConflict: 'student_id, classroom_id, date' });

            if (error) throw error;
        } catch (err: any) {
            console.error('Error marking attendance:', err);
            alert(`Failed to save attendance: ${err.message || err}`);
            // Revert status on failure
            fetchClassroomAttendance();
        } finally {
            setIsSavingAttendanceMap(prev => ({ ...prev, [studentId]: false }));
        }
    };

    // ── Fetch teacher's directory students (excluding already-enrolled) ────────
    const openDirectoryModal = async () => {
        if (!teacherProfile) return;
        setShowDirectoryModal(true);
        setDirectoryLoading(true);
        setSelectedToAdd(new Set());
        setDirectorySearch('');
        try {
            const enrolledIds = new Set(students.map(s => s.student_id));
            const { data, error } = await supabaseAuth
                .from('users')
                .select('id, name, profile_pic_url, status')
                .eq('role', 'student')
                .eq('teacher_id', teacherProfile.id);

            if (error) throw error;
            // Filter out already-enrolled students
            const available = (data || []).filter((s: any) => !enrolledIds.has(s.id));
            setDirectoryStudents(available);
        } catch (err) {
            console.error('Error fetching directory:', err);
        } finally {
            setDirectoryLoading(false);
        }
    };

    // ── Add selected students to this classroom ───────────────────────────────
    const handleAddStudents = async () => {
        if (selectedToAdd.size === 0) return;
        setIsAddingStudents(true);
        try {
            const rows = Array.from(selectedToAdd).map(studentId => ({
                classroom_id: classroomId,
                student_id: studentId,
                joined_at: new Date().toISOString(),
            }));

            const { error } = await supabaseAuth
                .from('classroom_students')
                .insert(rows);

            if (error) throw error;

            // Optimistically add to local state with mock metrics
            const statusOptions: ('Consistent' | 'Improving' | 'At Risk')[] = ['Consistent', 'Improving', 'At Risk'];
            const milestoneOptions = ['Alankars Mastery', 'Breath Control II', 'Fingering Basics', 'Rhythm Training', 'Raag Yaman Intros'];
            const addedStudentObjects = directoryStudents
                .filter(ds => selectedToAdd.has(ds.id))
                .map((ds, idx) => {
                    const seed = parseInt(ds.id.substring(0, 8), 16) || idx;
                    return {
                        id: `temp-${ds.id}`,
                        student_id: ds.id,
                        name: ds.name,
                        profile_pic_url: ds.profile_pic_url,
                        joined_at: new Date().toISOString(),
                        mock_score: 6 + ((seed % 40) / 10),
                        mock_progress: 50 + (seed % 50),
                        mock_attendance: 70 + (seed % 30),
                        mock_milestone: milestoneOptions[seed % milestoneOptions.length],
                        mock_status: idx % 3 === 0 ? 'Consistent' : (idx % 2 === 0 ? 'Improving' : 'At Risk') as any,
                    };
                });

            setStudents(prev => [...prev, ...addedStudentObjects]);
            setShowDirectoryModal(false);
        } catch (err) {
            console.error('Error adding students:', err);
            alert('Failed to add students. They may already be in this class.');
        } finally {
            setIsAddingStudents(false);
        }
    };

    // ── Remove a student from this classroom (not from the directory) ─────────
    const handleRemoveStudent = async (enrolledStudent: EnrolledStudent) => {
        if (!window.confirm(`Remove "${enrolledStudent.name}" from this classroom? Their student record will be kept.`)) return;
        setRemovingStudentId(enrolledStudent.id);
        try {
            const { error } = await supabaseAuth
                .from('classroom_students')
                .delete()
                .eq('classroom_id', classroomId)
                .eq('student_id', enrolledStudent.student_id);

            if (error) throw error;
            setStudents(prev => prev.filter(s => s.id !== enrolledStudent.id));
        } catch (err) {
            console.error('Error removing student:', err);
            alert('Failed to remove student from classroom.');
        } finally {
            setRemovingStudentId(null);
        }
    };

    const handleLogout = async () => {
        await supabaseAuth.auth.signOut();
        router.push('/');
    };

    // ── Create Assignment ──────────────────────────────────────────────────────
    const handleCreateAssignment = async () => {
        if (!assignmentForm.title.trim() || !teacherProfile) return;
        setIsSavingAssignment(true);
        setAssignmentError('');
        try {
            let file_url: string | null = assignmentForm.file_url || null;
            let file_name: string | null = assignmentForm.file_name || null;
            let file_size: number | null = assignmentForm.file_size || null;

            if (assignmentFile) {
                const filePath = `assignments/${classroomId}/${Date.now()}_${assignmentFile.name}`;
                const { error: uploadErr } = await supabaseAuth.storage
                    .from('class_notes')
                    .upload(filePath, assignmentFile);
                if (uploadErr) {
                    // Storage bucket may not exist — skip file upload, don't block
                    console.warn('File upload skipped (storage bucket may not exist):', uploadErr.message);
                }
                if (!uploadErr) {
                    const { data: urlData } = supabaseAuth.storage.from('class_notes').getPublicUrl(filePath);
                    file_url = urlData.publicUrl;
                    file_name = assignmentFile.name;
                    file_size = assignmentFile.size;
                }
            }

            const { data: newAsg, error } = await supabaseAuth
                .from('assignments')
                .insert([{
                    classroom_id: classroomId,
                    teacher_id: teacherProfile.id,
                    title: assignmentForm.title.trim(),
                    description: assignmentForm.description.trim() || null,
                    due_date: assignmentForm.due_date || null,
                    target_type: assignmentForm.target_type,
                    file_url,
                    file_name,
                    file_size,
                }])
                .select()
                .single();

            if (error) {
                const msg = error.message || JSON.stringify(error);
                console.error('Supabase insert assignments error:', error);
                setAssignmentError(`Failed to create assignment: ${msg}`);
                return;
            }

            // Insert assignment_students for either all students in classroom or selected individual students
            let assignedStudents: AssignmentStudent[] = [];
            let studentIdsToAssign: string[] = [];

            if (assignmentForm.target_type === 'all') {
                studentIdsToAssign = students.map(s => s.student_id);
            } else if (assignmentForm.target_type === 'individual') {
                studentIdsToAssign = Array.from(assignmentForm.selectedStudentIds);
            }

            if (studentIdsToAssign.length > 0) {
                const rows = studentIdsToAssign.map(sid => ({
                    assignment_id: newAsg.id,
                    student_id: sid,
                    status: 'pending',
                }));
                const { data: asData, error: asError } = await supabaseAuth
                    .from('assignment_students')
                    .insert(rows)
                    .select();
                if (asError) {
                    console.warn('Could not insert assignment_students:', asError.message);
                }
                assignedStudents = (asData || []).map((as: AssignmentStudent) => {
                    const match = students.find(s => s.student_id === as.student_id);
                    return { ...as, student_name: match?.name || 'Unknown', student_pic: match?.profile_pic_url || null };
                });
            }

            const fullAssignment: Assignment = { ...newAsg, assignment_students: assignedStudents };
            setAssignments(prev => [fullAssignment, ...prev]);

            // Reset
            closeAssignmentModal();
        } catch (err: any) {
            const msg = err?.message || String(err);
            console.error('Error creating assignment:', err);
            setAssignmentError(`Unexpected error: ${msg}`);
        } finally {
            setIsSavingAssignment(false);
        }
    };

    // ── Delete Assignment ──────────────────────────────────────────────────────
    const handleDeleteAssignment = async (id: string) => {
        if (!window.confirm('Delete this assignment?')) return;
        setDeletingAssignmentId(id);
        try {
            const { error } = await supabaseAuth.from('assignments').delete().eq('id', id);
            if (error) throw error;
            setAssignments(prev => prev.filter(a => a.id !== id));
            if (expandedAssignmentId === id) setExpandedAssignmentId(null);
        } catch (err) {
            console.error('Error deleting assignment:', err);
        } finally {
            setDeletingAssignmentId(null);
        }
    };

    // ── Save Class Note ────────────────────────────────────────────────────────
    const handleSaveNote = async () => {
        if (!noteForm.title.trim() || !teacherProfile) return;
        setIsSavingNote(true);
        setNoteError('');
        try {
            let file_url: string | null = editingNote?.file_url || null;
            let file_name: string | null = editingNote?.file_name || null;
            let file_size: number | null = editingNote?.file_size || null;

            if (noteFile) {
                const filePath = `notes/${classroomId}/${Date.now()}_${noteFile.name}`;
                const { error: uploadErr } = await supabaseAuth.storage
                    .from('class_notes')
                    .upload(filePath, noteFile);
                if (uploadErr) {
                    console.warn('File upload skipped (storage bucket may not exist):', uploadErr.message);
                } else {
                    const { data: urlData } = supabaseAuth.storage.from('class_notes').getPublicUrl(filePath);
                    file_url = urlData.publicUrl;
                    file_name = noteFile.name;
                    file_size = noteFile.size;
                }
            }

            if (editingNote) {
                const { data, error } = await supabaseAuth
                    .from('class_notes')
                    .update({ title: noteForm.title.trim(), content: noteForm.content.trim() || null, color: noteForm.color, file_url, file_name, file_size, updated_at: new Date().toISOString() })
                    .eq('id', editingNote.id)
                    .select()
                    .single();
                if (error) {
                    const msg = error.message || JSON.stringify(error);
                    console.error('Supabase update class_notes error:', error);
                    setNoteError(`Failed to update note: ${msg}`);
                    return;
                }
                setClassNotes(prev => prev.map(n => n.id === editingNote.id ? data : n));
            } else {
                const { data, error } = await supabaseAuth
                    .from('class_notes')
                    .insert([{ classroom_id: classroomId, teacher_id: teacherProfile.id, title: noteForm.title.trim(), content: noteForm.content.trim() || null, color: noteForm.color, file_url, file_name, file_size }])
                    .select()
                    .single();
                if (error) {
                    const msg = error.message || JSON.stringify(error);
                    console.error('Supabase insert class_notes error:', error);
                    setNoteError(`Failed to save note: ${msg}`);
                    return;
                }
                setClassNotes(prev => [data, ...prev]);
            }

            setShowNoteEditor(false);
            setEditingNote(null);
            setNoteForm({ title: '', content: '', color: 'yellow' });
            setNoteFile(null);
            setNoteError('');
        } catch (err: any) {
            const msg = err?.message || String(err);
            console.error('Error saving note:', err);
            setNoteError(`Unexpected error: ${msg}`);
        } finally {
            setIsSavingNote(false);
        }
    };

    // ── Delete Class Note ──────────────────────────────────────────────────────
    const handleDeleteNote = async (id: string) => {
        if (!window.confirm('Delete this note?')) return;
        setDeletingNoteId(id);
        try {
            const { error } = await supabaseAuth.from('class_notes').delete().eq('id', id);
            if (error) throw error;
            setClassNotes(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error('Error deleting note:', err);
        } finally {
            setDeletingNoteId(null);
        }
    };

    const openEditNote = (note: ClassNote) => {
        setEditingNote(note);
        setNoteForm({ title: note.title, content: note.content || '', color: note.color || 'yellow' });
        setNoteFile(null);
        setShowNoteEditor(true);
    };

    const openNewNote = () => {
        setEditingNote(null);
        setNoteForm({ title: '', content: '', color: 'yellow' });
        setNoteFile(null);
        setShowNoteEditor(true);
    };

    const NOTE_COLORS: Record<string, { bg: string; border: string; header: string; dot: string }> = {
        yellow: { bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-700/50', header: 'bg-amber-100/80 dark:bg-amber-800/30', dot: 'bg-amber-400' },
        blue:   { bg: 'bg-blue-50 dark:bg-blue-900/10',   border: 'border-blue-200 dark:border-blue-700/50',   header: 'bg-blue-100/80 dark:bg-blue-800/30',   dot: 'bg-blue-400'   },
        green:  { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-700/50', header: 'bg-emerald-100/80 dark:bg-emerald-800/30', dot: 'bg-emerald-400' },
        pink:   { bg: 'bg-pink-50 dark:bg-pink-900/10',   border: 'border-pink-200 dark:border-pink-700/50',   header: 'bg-pink-100/80 dark:bg-pink-800/30',   dot: 'bg-pink-400'   },
    };

    const formatFileSize = (bytes: number | null): string => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const filteredAssignments = useMemo(() => {
        if (assignmentFilter === 'all') return assignments;
        if (assignmentFilter === 'all_students') return assignments.filter(a => a.target_type === 'all');
        return assignments.filter(a => a.target_type === 'individual');
    }, [assignments, assignmentFilter]);

    const statusColors: Record<string, string> = {
        pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        reviewed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    };

    // ── Save classroom metadata ───────────────────────────────────────────────
    const handleSaveMetadata = async () => {
        if (!metadataForm.name.trim()) {
            setMetadataError('Class name is required.');
            return;
        }
        setIsSavingMetadata(true);
        setMetadataError('');
        setMetadataSaved(false);
        try {
            const { error } = await supabaseAuth
                .from('classrooms')
                .update({
                    name: metadataForm.name.trim(),
                    description: metadataForm.description.trim(),
                    status: metadataForm.status,
                })
                .eq('id', classroomId);

            if (error) throw error;

            // Update local classroom state so the header reflects the new name
            setClassroom(prev => prev ? {
                ...prev,
                name: metadataForm.name.trim(),
                description: metadataForm.description.trim(),
                status: metadataForm.status,
            } : prev);

            setMetadataSaved(true);
            setTimeout(() => setMetadataSaved(false), 3000);
        } catch (err: any) {
            console.error('Error saving metadata:', err);
            setMetadataError(err.message || 'Failed to save changes. Please try again.');
        } finally {
            setIsSavingMetadata(false);
        }
    };

    // ── Helper functions (defined before early return so hooks order is stable) ─
    const getStatusColor = (status: string) => {
        if (status === 'Consistent') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        if (status === 'Improving') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    };

    const getProgressBarColor = (status: string) => {
        if (status === 'Consistent') return 'bg-emerald-500';
        if (status === 'Improving') return 'bg-amber-500';
        return 'bg-rose-500';
    };

    const getGrade = (score: number) => {
        if (score >= 9.5) return 'A+';
        if (score >= 8.5) return 'A';
        if (score >= 7.5) return 'B+';
        if (score >= 6.5) return 'B';
        return 'C';
    };

    const formatTime12hr = (time24: string) => {
        if (!time24) return '';
        const [h, m] = time24.split(':');
        let hours = parseInt(h, 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const hStr = hours.toString().padStart(2, '0');
        return `${hStr}:${m} ${ampm}`;
    };

    const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

    const totalPages = Math.ceil(students.length / PAGE_SIZE);
    const paginatedStudents = students.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const avgAttendance = students.length > 0
        ? (students.reduce((acc, curr) => acc + curr.mock_attendance, 0) / students.length).toFixed(1)
        : '0.0';

    // ── useMemo MUST be above any early return (Rules of Hooks) ──────────────
    const filteredDirectory = useMemo(() => {
        if (!directorySearch.trim()) return directoryStudents;
        const q = directorySearch.toLowerCase();
        return directoryStudents.filter(s => s.name.toLowerCase().includes(q));
    }, [directoryStudents, directorySearch]);

    if (loading || !classroom) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f8f6]">
                <Loader2 className="w-10 h-10 animate-spin text-[#ecb613] mb-4" />
                <p className="font-medium text-slate-600 tracking-wide uppercase text-xs">Loading Classroom Dashboard...</p>
            </div>
        );
    }

    const handleSaveSchedule = async () => {
        if (!classroomId) return;

        // Local check for duplicates
        const isDuplicate = schedules.some(s =>
            s.day_of_week === newSchedule.day &&
            s.start_time.startsWith(newSchedule.start)
        );

        if (isDuplicate) {
            alert('This schedule slot already exists for this class.');
            return;
        }

        setIsSavingSchedule(true);
        try {
            const { data, error } = await supabaseAuth
                .from('batch_schedules')
                .insert([{
                    classroom_id: classroomId,
                    day_of_week: newSchedule.day,
                    start_time: newSchedule.start,
                    end_time: newSchedule.end
                }])
                .select();

            if (error) {
                // Handle Supabase unique constraint violation
                if (error.code === '23505') {
                    alert('This schedule slot already exists.');
                    return;
                }
                throw error;
            }

            if (data) {
                setSchedules(prev => [...prev, data[0]].sort((a, b) => a.day_of_week - b.day_of_week));
                setNewSchedule({ day: 0, start: '09:00', end: '10:30' });
            }
        } catch (err) {
            console.error('Error saving schedule:', err);
            alert('Failed to save schedule');
        } finally {
            setIsSavingSchedule(false);
        }
    };

    const handleDeleteSchedule = async (id: string) => {
        try {
            const { error } = await supabaseAuth
                .from('batch_schedules')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setSchedules(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            console.error('Error deleting schedule:', err);
            alert('Failed to delete schedule');
        }
    };

    return (
        <div className="flex min-h-screen bg-[#f8f8f6] dark:bg-[#221d10] text-slate-900 dark:text-slate-100 font-sans">

            {/* ── Add from Directory Modal ─────────────────────────────────────── */}
            {showDirectoryModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#ecb613]/10 flex items-center justify-center">
                                    <UserPlus className="w-5 h-5 text-[#ecb613]" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Add from Student Directory</h3>
                                    <p className="text-xs text-slate-500">Select students to enroll in <span className="font-semibold">{classroom?.name}</span></p>
                                </div>
                            </div>
                            <button onClick={() => setShowDirectoryModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search students..."
                                    value={directorySearch}
                                    onChange={e => setDirectorySearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/20 focus:border-[#ecb613] outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Student list */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
                            {directoryLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-7 h-7 animate-spin text-[#ecb613]" />
                                </div>
                            ) : filteredDirectory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                                    <p className="text-sm font-semibold text-slate-500">
                                        {directoryStudents.length === 0
                                            ? 'All your students are already in this classroom.'
                                            : 'No students match your search.'}
                                    </p>
                                    {directoryStudents.length === 0 && (
                                        <Link
                                            href="/teacher-dashboard/students/add"
                                            className="mt-3 text-xs font-bold text-[#ecb613] hover:underline"
                                        >
                                            + Add a new student to your directory
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                filteredDirectory.map(s => {
                                    const isSelected = selectedToAdd.has(s.id);
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => setSelectedToAdd(prev => {
                                                const next = new Set(prev);
                                                isSelected ? next.delete(s.id) : next.add(s.id);
                                                return next;
                                            })}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                                                isSelected
                                                    ? 'border-[#ecb613] bg-[#ecb613]/5 dark:bg-[#ecb613]/10'
                                                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                            }`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-[#ecb613]/10 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm flex-shrink-0">
                                                {s.profile_pic_url ? (
                                                    <img src={s.profile_pic_url} alt={s.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-sm font-bold text-[#ecb613]">{s.name.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{s.name}</p>
                                                <p className="text-xs text-slate-500">
                                                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${s.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                                    {s.status === 'active' ? 'Active' : 'Inactive'}
                                                </p>
                                            </div>
                                            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                                                isSelected
                                                    ? 'bg-[#ecb613] border-[#ecb613]'
                                                    : 'border-slate-300 dark:border-slate-600'
                                            }`}>
                                                {isSelected && (
                                                    <svg className="w-3 h-3 text-slate-900" fill="none" viewBox="0 0 12 12">
                                                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-shrink-0">
                            <span className="text-xs font-semibold text-slate-500">
                                {selectedToAdd.size > 0 ? `${selectedToAdd.size} student${selectedToAdd.size !== 1 ? 's' : ''} selected` : 'Click students to select'}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowDirectoryModal(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddStudents}
                                    disabled={selectedToAdd.size === 0 || isAddingStudents}
                                    className="px-4 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isAddingStudents ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                    {isAddingStudents ? 'Adding...' : `Add ${selectedToAdd.size > 0 ? selectedToAdd.size : ''} to Class`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <TeacherSidebar teacherProfile={teacherProfile} handleLogout={handleLogout} />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* TopAppBar */}
                <header className="flex justify-between items-center px-8 h-16 w-full max-w-full mx-auto bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <Link href="/teacher-dashboard/classrooms" className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h2 className="text-xl font-bold text-[#ecb613] dark:text-[#ecb613]">{classroom.name}</h2>
                        <span className="px-2 py-1 bg-[#ecb613]/10 text-[#ecb613] dark:bg-[#ecb613]/20 dark:text-[#ecb613] text-[10px] font-bold rounded uppercase tracking-wider">{classroom.status}</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input 
                                className="pl-10 pr-4 py-1.5 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-[#ecb613] outline-none transition-all placeholder:text-slate-400" 
                                placeholder="Search students, tasks..." 
                                type="text" 
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <button className="text-slate-500 hover:text-[#ecb613] transition-colors">
                                <Bell className="w-5 h-5" />
                            </button>
                            <button className="text-slate-500 hover:text-[#ecb613] transition-colors">
                                <HelpCircle className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </header>

                <div className="p-8 max-w-7xl mx-auto w-full flex-1 overflow-y-auto">
                    {/* Row-wise Tabs (Contextual Navigation) */}
                    <div className="flex items-center gap-8 border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto custom-scrollbar whitespace-nowrap">
                        {['Overview', 'Curriculum', 'Students', 'Assignments', 'Attendance', 'Settings'].map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-4 font-semibold transition-colors border-b-2 ${
                                    activeTab === tab 
                                        ? 'text-[#ecb613] dark:text-[#ecb613] border-[#ecb613] dark:border-[#ecb613]' 
                                        : 'text-slate-500 dark:text-slate-400 hover:text-[#ecb613]/80 border-transparent'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'Overview' ? (
                        <div className="grid grid-cols-12 gap-6">
                            {/* Progress Summary Card */}
                            <div className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Individual Progress Summary</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Milestone tracking for the current week</p>
                                    </div>
                                    <button className="text-[#ecb613] text-sm font-semibold hover:underline">View Detailed Analytics</button>
                                </div>
                                <div className="space-y-6">
                                    {students.slice(0, 4).map(student => (
                                        <div key={student.id} className="flex items-center gap-4 group">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                                                {student.profile_pic_url ? (
                                                    <img alt={student.name} className="w-full h-full object-cover" src={student.profile_pic_url} loading="lazy" />
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{student.name.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors">{student.name}</span>
                                                    <span className={`text-xs font-bold ${
                                                        student.mock_status === 'Consistent' ? 'text-emerald-500' : (student.mock_status === 'Improving' ? 'text-[#ecb613]' : 'text-rose-500')
                                                    }`}>{student.mock_milestone}</span>
                                                </div>
                                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                    <div className={`h-full ${getProgressBarColor(student.mock_status)}`} style={{ width: `${student.mock_progress}%` }}></div>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-400 w-8 text-right">{student.mock_progress}%</span>
                                        </div>
                                    ))}
                                    {students.length === 0 && (
                                        <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                            <p className="text-slate-500 text-sm font-medium">No students enrolled yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stats Card */}
                            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                                <div className="bg-[#ecb613] dark:bg-[#ecb613]/90 p-6 rounded-2xl text-slate-900 relative overflow-hidden shadow-lg shadow-[#ecb613]/20">
                                    <div className="absolute -right-4 -bottom-4 opacity-10">
                                        <Users className="w-32 h-32" />
                                    </div>
                                    <h4 className="text-slate-900/70 text-sm font-black uppercase tracking-wider mb-2">Class Attendance</h4>
                                    <div className="flex items-end gap-2 relative z-10">
                                        <span className="text-4xl font-black">{avgAttendance}%</span>
                                        <span className="text-slate-900/80 text-sm font-bold mb-1 pb-1 flex items-center">
                                            <TrendingUp className="w-4 h-4 mr-1 stroke-[3]" />
                                            +2.1%
                                        </span>
                                    </div>
                                    <p className="mt-4 text-xs text-slate-900/80 leading-relaxed font-semibold relative z-10">
                                        Average attendance across recent sessions. Overall class consistency is looking good!
                                    </p>
                                </div>

                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Class Schedule</h4>
                                        <Clock className="w-5 h-5 text-[#ecb613]" />
                                    </div>
                                    <div className="space-y-3">
                                        {schedules.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic">No schedule set</p>
                                        ) : (
                                            schedules.slice(0, 3).map(slot => (
                                                <div key={slot.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{DAY_NAMES[slot.day_of_week]}</span>
                                                    <span className="text-xs font-medium text-[#ecb613]">{formatTime12hr(slot.start_time)} - {formatTime12hr(slot.end_time)}</span>
                                                </div>
                                            ))
                                        )}
                                        {schedules.length > 3 && (
                                            <button onClick={() => setActiveTab('Settings')} className="text-[10px] font-bold text-[#ecb613] hover:underline w-full text-center mt-2">
                                                View all {schedules.length} slots
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Quick Actions</h4>
                                        <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button className="p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#ecb613]/10 rounded-xl text-center transition-all group border border-slate-200 dark:border-slate-700 hover:border-[#ecb613]/30 flex flex-col items-center justify-center">
                                            <Mail className="w-6 h-6 text-[#ecb613] mb-2 group-hover:scale-110 transition-transform" />
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white uppercase tracking-wide">Email All</span>
                                        </button>
                                        <Link 
                                            href={`/teacher-dashboard/classrooms/${classroomId}/meeting`}
                                            className="p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-[#ecb613]/10 rounded-xl text-center transition-all group border border-slate-200 dark:border-slate-700 hover:border-[#ecb613]/30 flex flex-col items-center justify-center"
                                        >
                                            <Video className="w-6 h-6 text-[#ecb613] mb-2 group-hover:scale-110 transition-transform" />
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white uppercase tracking-wide">Start Session</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Student Roster Table */}
                            <div className="col-span-12 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mt-2">
                                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Student Roster</h3>
                                    <div className="flex gap-3">
                                        <button className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">Export PDF</button>
                                        <button
                                            onClick={openDirectoryModal}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-[#ecb613] shadow-md shadow-[#ecb613]/20 hover:bg-[#ecb613]/90 text-slate-900 rounded-xl text-xs font-bold transition-colors"
                                        >
                                            <UserPlus className="w-3.5 h-3.5" />
                                            Add from Directory
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">Student Name</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4">Avg. Score</th>
                                                <th className="px-6 py-4">Attendance</th>
                                                <th className="px-6 py-4">Joined Date</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {paginatedStudents.map(student => (
                                                <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600">
                                                                {student.profile_pic_url ? (
                                                                    <img alt={student.name} className="w-full h-full object-cover" src={student.profile_pic_url} loading="lazy" />
                                                                ) : (
                                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{student.name.charAt(0)}</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <Link href={`/teacher-dashboard/students/${student.student_id}`} className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors">{student.name}</Link>
                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">ID: {student.student_id.substring(0, 8)}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wide inline-block border ${getStatusColor(student.mock_status)} border-transparent dark:border-current/20`}>
                                                            {student.mock_status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{student.mock_score.toFixed(1)}</span>
                                                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                                                        {student.mock_attendance}%
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                        {new Date(student.joined_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleRemoveStudent(student)}
                                                            disabled={removingStudentId === student.id}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all disabled:opacity-50"
                                                            title="Remove from this classroom"
                                                        >
                                                            {removingStudentId === student.id
                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                : <Trash2 className="w-3.5 h-3.5" />}
                                                            Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {paginatedStudents.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center bg-slate-50 dark:bg-slate-800/30">
                                                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-3">No students enrolled yet.</p>
                                                        <button
                                                            onClick={openDirectoryModal}
                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#ecb613] text-slate-900 rounded-xl text-xs font-bold hover:bg-[#ecb613]/90 transition-colors shadow-sm"
                                                        >
                                                            <UserPlus className="w-4 h-4" /> Add from Directory
                                                        </button>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center rounded-b-2xl">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Showing {paginatedStudents.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} - {Math.min(currentPage * PAGE_SIZE, students.length)} of {students.length} students
                                    </span>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
                                        >
                                            Previous
                                        </button>
                                        <button 
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages || totalPages === 0}
                                            className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'Curriculum' ? (
                        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Section 1: Lesson Plan / Syllabus Roadmap */}
                            <section className="mb-12">
                                <div className="flex justify-between items-end mb-6">
                                    <div>
                                        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Syllabus Roadmap</h2>
                                        <p className="text-slate-500 dark:text-slate-400 mt-1">Foundational Flute Techniques & Repertoire</p>
                                    </div>
                                    <button className="bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-sm">
                                        <Edit3 className="w-5 h-5" />
                                        Edit Roadmap
                                    </button>
                                </div>
                                <div className="relative grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {/* Progress Connection Line (Dashed) */}
                                    <div className="absolute top-1/2 left-0 w-full h-0.5 border-t-2 border-dashed border-slate-200 dark:border-slate-700 -z-10 hidden md:block"></div>
                                    
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                                        <div className="w-8 h-8 bg-[#ecb613] text-slate-900 rounded-full flex items-center justify-center font-black text-xs mb-3 shadow-md shadow-[#ecb613]/20">01</div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">Breath Control</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">Week 1-2</p>
                                        <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-[#ecb613] w-full"></div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                                        <div className="w-8 h-8 bg-[#ecb613] text-slate-900 rounded-full flex items-center justify-center font-black text-xs mb-3 shadow-md shadow-[#ecb613]/20">02</div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">Embouchure</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">Week 3-4</p>
                                        <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-[#ecb613] w-full"></div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                                        <div className="w-8 h-8 bg-[#ecb613]/20 dark:bg-[#ecb613]/10 text-[#ecb613] rounded-full flex items-center justify-center font-black text-xs mb-3">03</div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">First Scale</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">Week 5-8</p>
                                        <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-[#ecb613] w-1/3"></div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2 group cursor-pointer hover:border-[#ecb613] hover:bg-[#ecb613]/5 transition-all">
                                        <PlusCircle className="w-8 h-8 text-slate-300 dark:text-slate-600 group-hover:text-[#ecb613] transition-colors" />
                                        <span className="text-sm font-bold text-slate-400 group-hover:text-[#ecb613] transition-colors">Add Milestone</span>
                                    </div>
                                </div>
                            </section>

                            {/* Section 2 & 3: Modules and Materials */}
                            <section className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Curriculum Modules</h2>
                                    <div className="flex gap-3">
                                        <button className="text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                                            <FileUp className="w-4 h-4" />
                                            Upload Resource
                                        </button>
                                        <button className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm">
                                            <Plus className="w-4 h-4" />
                                            Add Module
                                        </button>
                                    </div>
                                </div>

                                {/* Module 1 */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm group">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-4">
                                            <GripVertical className="w-5 h-5 text-slate-400 cursor-move opacity-50 group-hover:opacity-100 transition-opacity" />
                                            <div>
                                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Module 1: Introduction to Flute</h3>
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">3 Lessons • 2 Resources • 1 Assignment</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-widest">Active</span>
                                            <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                                                <MoreVertical className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                                        {/* Module Lessons */}
                                        <div className="md:col-span-2 space-y-3">
                                            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:shadow-md hover:border-[#ecb613]/30 transition-all cursor-pointer group/lesson">
                                                <div className="flex items-center gap-4">
                                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 group-hover/lesson:bg-[#ecb613] group-hover/lesson:text-slate-900 transition-colors">1.1</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover/lesson:text-slate-900 dark:group-hover/lesson:text-white">Assembling your Instrument</span>
                                                </div>
                                                <CheckCircle className="w-5 h-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-900/40" />
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:shadow-md hover:border-[#ecb613]/30 transition-all cursor-pointer group/lesson">
                                                <div className="flex items-center gap-4">
                                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 group-hover/lesson:bg-[#ecb613] group-hover/lesson:text-slate-900 transition-colors">1.2</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover/lesson:text-slate-900 dark:group-hover/lesson:text-white">Posture and Hand Position</span>
                                                </div>
                                                <CheckCircle className="w-5 h-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-900/40" />
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:shadow-md hover:border-[#ecb613]/30 transition-all cursor-pointer group/lesson">
                                                <div className="flex items-center gap-4">
                                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 group-hover/lesson:bg-[#ecb613]/50 group-hover/lesson:text-slate-900 transition-colors">1.3</span>
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover/lesson:text-slate-900 dark:group-hover/lesson:text-white">The Headjoint Exercise</span>
                                                </div>
                                                <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 stroke-[3]" />
                                            </div>
                                        </div>
                                        {/* Module Materials */}
                                        <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Attached Materials</h4>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-red-500/30 transition-colors cursor-pointer group/mat">
                                                    <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-center justify-center group-hover/mat:bg-red-100 transition-colors">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover/mat:text-slate-900 dark:group-hover/mat:text-white">Assembly_Guide.pdf</p>
                                                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">1.2 MB</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500/30 transition-colors cursor-pointer group/mat">
                                                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center group-hover/mat:bg-blue-100 transition-colors">
                                                        <Film className="w-5 h-5" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover/mat:text-slate-900 dark:group-hover/mat:text-white">Embouchure_Demo.mp4</p>
                                                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">45.8 MB</p>
                                                    </div>
                                                </div>
                                                <button className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-center justify-center gap-2">
                                                    <Plus className="w-4 h-4" /> Add Material
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Module 2 */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm group">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-4">
                                            <GripVertical className="w-5 h-5 text-slate-400 cursor-move opacity-50 group-hover:opacity-100 transition-opacity" />
                                            <div>
                                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Module 2: Basic Fingerings</h3>
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">4 Lessons • 3 Resources • 2 Assignments</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="bg-[#ecb613]/20 text-[#ecb613] text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-widest">In Progress</span>
                                            <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                                                <MoreVertical className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8 opacity-75">
                                        {/* Module Lessons */}
                                        <div className="md:col-span-2 space-y-3">
                                            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                <div className="flex items-center gap-4 opacity-70">
                                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500">2.1</span>
                                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Notes B, A, and G</span>
                                                </div>
                                                <Lock className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                <div className="flex items-center gap-4 opacity-70">
                                                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500">2.2</span>
                                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Reading Music Notation</span>
                                                </div>
                                                <Lock className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                                            </div>
                                        </div>
                                        {/* Module Materials */}
                                        <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Attached Materials</h4>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                                    <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center">
                                                        <Music className="w-5 h-5" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-400 truncate">Scale_Practice_Track.wav</p>
                                                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">8.4 MB</p>
                                                    </div>
                                                </div>
                                                <button className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                                                    <Plus className="w-4 h-4" /> Add Material
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Empty state for next module */}
                                <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl py-12 flex flex-col items-center justify-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <PlusCircle className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-[#ecb613] transition-colors" />
                                    </div>
                                    <div className="text-center">
                                        <h4 className="font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">Create Module 3</h4>
                                        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1">Define the next steps for your students</p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    ) : activeTab === 'Students' ? (
                        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Actions Header */}
                            <div className="flex justify-between items-end">
                                <div>
                                    <h3 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Student Roster</h3>
                                    <p className="text-slate-500 dark:text-slate-400 mt-1">Managing {students.length} students in {classroom.name}</p>
                                </div>
                                <div className="flex gap-3">
                                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                                        <Mail className="w-5 h-5" />
                                        Message All
                                    </button>
                                    <button
                                        onClick={openDirectoryModal}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#ecb613] text-slate-900 rounded-lg font-semibold hover:bg-[#ecb613]/90 transition-all shadow-md shadow-[#ecb613]/20"
                                    >
                                        <UserPlus className="w-5 h-5" />
                                        Add from Directory
                                    </button>
                                </div>
                            </div>

                            {/* Student Table / Roster */}
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-2">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student</th>
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Progress</th>
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attendance</th>
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Grade</th>
                                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                            {paginatedStudents.map(student => (
                                                <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                                                                {student.profile_pic_url ? (
                                                                    <img alt={student.name} className="w-full h-full object-cover" src={student.profile_pic_url} loading="lazy" />
                                                                ) : (
                                                                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{student.name.charAt(0)}</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <Link href={`/teacher-dashboard/students/${student.student_id}`} className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#ecb613] transition-colors">{student.name}</Link>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">{student.name.toLowerCase().replace(' ', '.')}@academy.edu</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${student.mock_status === 'At Risk' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' : getStatusColor(student.mock_status)}`}>
                                                            {student.mock_status === 'At Risk' ? 'Needs Attention' : student.mock_status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="w-32">
                                                            <div className="flex justify-between mb-1">
                                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{student.mock_progress}% Complete</span>
                                                            </div>
                                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 flex overflow-hidden">
                                                                <div className={`h-1.5 rounded-full ${student.mock_status === 'At Risk' ? 'bg-rose-500' : 'bg-[#ecb613]'}`} style={{ width: `${student.mock_progress}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">{student.mock_attendance}%</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{getGrade(student.mock_score)}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleRemoveStudent(student)}
                                                            disabled={removingStudentId === student.id}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all disabled:opacity-50"
                                                            title="Remove from this classroom"
                                                        >
                                                            {removingStudentId === student.id
                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                : <Trash2 className="w-3.5 h-3.5" />}
                                                            Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {paginatedStudents.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center bg-slate-50 dark:bg-slate-800/30">
                                                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-3">No students enrolled yet.</p>
                                                        <button
                                                            onClick={openDirectoryModal}
                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#ecb613] text-slate-900 rounded-xl text-xs font-bold hover:bg-[#ecb613]/90 transition-colors shadow-sm"
                                                        >
                                                            <UserPlus className="w-4 h-4" /> Add from Directory
                                                        </button>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center rounded-b-xl">
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                        Showing {paginatedStudents.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} - {Math.min(currentPage * PAGE_SIZE, students.length)} of {students.length} students
                                    </p>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                        >
                                            Previous
                                        </button>
                                        <button 
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages || totalPages === 0}
                                            className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Focus Tasks / Assistant View */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:grid-cols-3">
                                <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/50 p-6 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-3 mb-4 text-rose-800 dark:text-rose-400">
                                        <AlertTriangle className="w-5 h-5" />
                                        <h4 className="font-bold">Urgent Attention Needed</h4>
                                    </div>
                                    <p className="text-sm text-rose-700 dark:text-rose-300 mb-4">Julian Chen has missed 3 consecutive classes and hasn't submitted the 'Bach Invention No. 4' assignment.</p>
                                    <button className="w-full py-2 bg-rose-600 dark:bg-rose-700 text-white rounded-lg font-bold text-sm hover:bg-rose-700 dark:hover:bg-rose-600 transition-colors">
                                        Message Guardian
                                    </button>
                                </div>
                                <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/50 p-6 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-3 mb-4 text-indigo-800 dark:text-indigo-400">
                                        <Sparkles className="w-5 h-5" />
                                        <h4 className="font-bold">Next Milestone</h4>
                                    </div>
                                    <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-4">The Mid-Term Performance Exam is in 8 days. 18/{students.length || 24} students have already signed up for their time slots.</p>
                                    <button className="w-full py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors">
                                        Review Exam Schedule
                                    </button>
                                </div>
                                <div className="p-6 rounded-xl shadow-lg relative overflow-hidden text-slate-900 flex flex-col justify-between" style={{ backgroundColor: '#ecb613' }}>
                                    <div>
                                        <BarChart2 className="w-8 h-8 mb-4 opacity-80" />
                                        <h4 className="text-sm font-bold opacity-80 uppercase tracking-wider text-slate-900/80">Avg. Attendance</h4>
                                        <p className="text-4xl font-black mt-1 text-slate-900">{avgAttendance}%</p>
                                    </div>
                                    <div className="pt-4 border-t border-slate-900/20 mt-4">
                                        <p className="text-xs font-semibold italic text-slate-900/80">"Strongest participation on Wednesdays."</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'Assignments' ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* ── Create Assignment Modal ───────────────────────────────────── */}
                            {showAssignmentModal && (
                                <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
                                        {/* Header */}
                                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-[#ecb613]/10 flex items-center justify-center">
                                                    <ClipboardList className="w-5 h-5 text-[#ecb613]" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900 dark:text-white">Create Assignment</h3>
                                                    <p className="text-xs text-slate-500">for <span className="font-semibold">{classroom?.name}</span></p>
                                                </div>
                                            </div>
                                            <button onClick={closeAssignmentModal} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Body */}
                                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                                            {/* Title */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Title <span className="text-rose-500">*</span></label>
                                                <input
                                                    id="assignment-title-input"
                                                    type="text"
                                                    placeholder="e.g., Practice Raag Yaman — Sa Re Ga Ma"
                                                    value={assignmentForm.title}
                                                    onChange={e => setAssignmentForm(f => ({ ...f, title: e.target.value }))}
                                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all"
                                                />
                                            </div>

                                            {/* Description */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
                                                <textarea
                                                    id="assignment-description-input"
                                                    rows={3}
                                                    placeholder="Describe what the student needs to do..."
                                                    value={assignmentForm.description}
                                                    onChange={e => setAssignmentForm(f => ({ ...f, description: e.target.value }))}
                                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all resize-none"
                                                />
                                            </div>

                                            {/* Due Date */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Due Date</label>
                                                <input
                                                    id="assignment-due-date"
                                                    type="date"
                                                    value={assignmentForm.due_date}
                                                    onChange={e => setAssignmentForm(f => ({ ...f, due_date: e.target.value }))}
                                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all"
                                                />
                                            </div>

                                            {/* Target Toggle */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Assign To</label>
                                                <div className="flex gap-2">
                                                    <button
                                                        id="target-all-btn"
                                                        onClick={() => setAssignmentForm(f => ({ ...f, target_type: 'all', selectedStudentIds: new Set() }))}
                                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all flex-1 justify-center ${
                                                            assignmentForm.target_type === 'all'
                                                                ? 'border-[#ecb613] bg-[#ecb613]/10 text-[#ecb613]'
                                                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <UsersRound className="w-4 h-4" />
                                                        All Students
                                                    </button>
                                                    <button
                                                        id="target-individual-btn"
                                                        onClick={() => setAssignmentForm(f => ({ ...f, target_type: 'individual' }))}
                                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all flex-1 justify-center ${
                                                            assignmentForm.target_type === 'individual'
                                                                ? 'border-[#ecb613] bg-[#ecb613]/10 text-[#ecb613]'
                                                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <User className="w-4 h-4" />
                                                        Individual
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Individual student picker */}
                                            {assignmentForm.target_type === 'individual' && (
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Select Students <span className="text-rose-500">*</span></label>
                                                    {students.length === 0 ? (
                                                        <p className="text-sm text-slate-500 italic text-center py-4">No students enrolled in this classroom.</p>
                                                    ) : (
                                                        <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-700 rounded-xl p-2">
                                                            {students.map(s => {
                                                                const isSel = assignmentForm.selectedStudentIds.has(s.student_id);
                                                                return (
                                                                    <button
                                                                        key={s.student_id}
                                                                        onClick={() => setAssignmentForm(f => {
                                                                            const next = new Set(f.selectedStudentIds);
                                                                            isSel ? next.delete(s.student_id) : next.add(s.student_id);
                                                                            return { ...f, selectedStudentIds: next };
                                                                        })}
                                                                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                                                                            isSel
                                                                                ? 'bg-[#ecb613]/10 border-2 border-[#ecb613]'
                                                                                : 'bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent hover:border-slate-200'
                                                                        }`}
                                                                    >
                                                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                                            {s.profile_pic_url
                                                                                ? <img src={s.profile_pic_url} alt={s.name} className="w-full h-full object-cover" />
                                                                                : <span className="text-xs font-bold text-slate-500">{s.name.charAt(0)}</span>
                                                                            }
                                                                        </div>
                                                                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1">{s.name}</span>
                                                                        <div className={`w-4 h-4 rounded flex items-center justify-center border-2 flex-shrink-0 ${
                                                                            isSel ? 'bg-[#ecb613] border-[#ecb613]' : 'border-slate-300 dark:border-slate-600'
                                                                        }`}>
                                                                            {isSel && <svg className="w-2.5 h-2.5 text-slate-900" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    {assignmentForm.selectedStudentIds.size > 0 && (
                                                        <p className="text-xs font-semibold text-[#ecb613] mt-1.5">{assignmentForm.selectedStudentIds.size} student{assignmentForm.selectedStudentIds.size !== 1 ? 's' : ''} selected</p>
                                                    )}
                                                </div>
                                            )}

                                            {/* File Attachment */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Attach File <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
                                                <input ref={assignmentFileRef} type="file" accept=".pdf,.doc,.docx,.mp3,.mp4,.wav,.jpg,.jpeg,.png" className="hidden" onChange={e => {
                                                    setAssignmentFile(e.target.files?.[0] || null);
                                                    if (e.target.files?.[0]) {
                                                        setAssignmentForm(f => ({ ...f, file_url: null, file_name: null, file_size: null }));
                                                    }
                                                }} />
                                                {assignmentFile || assignmentForm.file_url ? (
                                                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                                        <Paperclip className="w-4 h-4 text-[#ecb613] flex-shrink-0" />
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">
                                                            {assignmentFile ? assignmentFile.name : assignmentForm.file_name}
                                                        </span>
                                                        <span className="text-xs text-slate-400">
                                                            {formatFileSize(assignmentFile ? assignmentFile.size : assignmentForm.file_size)}
                                                        </span>
                                                        <button onClick={() => {
                                                            setAssignmentFile(null);
                                                            setAssignmentForm(f => ({ ...f, file_url: null, file_name: null, file_size: null }));
                                                        }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X className="w-3.5 h-3.5 text-slate-400" /></button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => assignmentFileRef.current?.click()}
                                                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-500 hover:border-[#ecb613]/50 hover:text-[#ecb613] hover:bg-[#ecb613]/5 transition-all"
                                                    >
                                                        <Upload className="w-4 h-4" />
                                                        Click to attach a file
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3 flex-shrink-0">
                                            {assignmentError && (
                                                <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
                                                    <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                                                    <p className="text-xs font-medium text-rose-700 dark:text-rose-400 break-all">{assignmentError}</p>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={closeAssignmentModal}
                                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                >Cancel</button>
                                                <button
                                                    id="create-assignment-submit-btn"
                                                    onClick={handleCreateAssignment}
                                                    disabled={isSavingAssignment || !assignmentForm.title.trim() || (assignmentForm.target_type === 'individual' && assignmentForm.selectedStudentIds.size === 0)}
                                                    className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 shadow-md shadow-[#ecb613]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    {isSavingAssignment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                    {isSavingAssignment ? 'Creating...' : 'Create Assignment'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Note Editor Modal ─────────────────────────────────────── */}
                            {showNoteEditor && (
                                <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
                                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-[#ecb613]/10 flex items-center justify-center">
                                                    <StickyNote className="w-5 h-5 text-[#ecb613]" />
                                                </div>
                                                <h3 className="font-bold text-slate-900 dark:text-white">{editingNote ? 'Edit Note' : 'New Class Note'}</h3>
                                            </div>
                                            <button onClick={() => { setShowNoteEditor(false); setEditingNote(null); }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="px-6 py-5 space-y-4">
                                            {/* Color picker */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Note Color</label>
                                                <div className="flex gap-2">
                                                    {Object.entries(NOTE_COLORS).map(([color, palette]) => (
                                                        <button
                                                            key={color}
                                                            onClick={() => setNoteForm(f => ({ ...f, color }))}
                                                            className={`w-8 h-8 rounded-full border-2 transition-all ${palette.dot} ${
                                                                noteForm.color === color ? 'border-slate-700 dark:border-white scale-110' : 'border-transparent'
                                                            }`}
                                                            title={color}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Title */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Title <span className="text-rose-500">*</span></label>
                                                <input
                                                    id="note-title-input"
                                                    type="text"
                                                    placeholder="e.g., Week 3 Class Notes — Raga Bhairav"
                                                    value={noteForm.title}
                                                    onChange={e => setNoteForm(f => ({ ...f, title: e.target.value }))}
                                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all"
                                                />
                                            </div>

                                            {/* Content */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Content</label>
                                                <textarea
                                                    id="note-content-input"
                                                    rows={5}
                                                    placeholder="Write your class notes here..."
                                                    value={noteForm.content}
                                                    onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))}
                                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all resize-none"
                                                />
                                            </div>

                                            {/* File attachment */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">Upload File <span className="text-slate-400 font-normal normal-case">(PDF, audio, image)</span></label>
                                                <input ref={noteFileRef} type="file" accept=".pdf,.doc,.docx,.mp3,.mp4,.wav,.jpg,.jpeg,.png" className="hidden" onChange={e => setNoteFile(e.target.files?.[0] || null)} />
                                                {noteFile || editingNote?.file_url ? (
                                                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                                        <Paperclip className="w-4 h-4 text-[#ecb613] flex-shrink-0" />
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">{noteFile?.name || editingNote?.file_name}</span>
                                                        <span className="text-xs text-slate-400">{formatFileSize(noteFile?.size || editingNote?.file_size || null)}</span>
                                                        <button onClick={() => { setNoteFile(null); if (editingNote) setEditingNote(prev => prev ? { ...prev, file_url: null, file_name: null } : null); }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"><X className="w-3.5 h-3.5 text-slate-400" /></button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => noteFileRef.current?.click()}
                                                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-500 hover:border-[#ecb613]/50 hover:text-[#ecb613] hover:bg-[#ecb613]/5 transition-all"
                                                    >
                                                        <Upload className="w-4 h-4" /> Attach a file
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                                            {noteError && (
                                                <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
                                                    <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                                                    <p className="text-xs font-medium text-rose-700 dark:text-rose-400 break-all">{noteError}</p>
                                                </div>
                                            )}
                                            <div className="flex justify-end gap-3">
                                                <button onClick={() => { setShowNoteEditor(false); setEditingNote(null); setNoteError(''); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                                                <button
                                                    id="save-note-btn"
                                                    onClick={handleSaveNote}
                                                    disabled={isSavingNote || !noteForm.title.trim()}
                                                    className="px-5 py-2 rounded-lg text-sm font-bold bg-[#ecb613] text-slate-900 hover:bg-[#ecb613]/90 shadow-md shadow-[#ecb613]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                                                    {isSavingNote ? 'Saving...' : (editingNote ? 'Update Note' : 'Save Note')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── DB Setup Error Banner ──────────────────────────────────── */}
                            {dbSetupError && (
                                <div className="mb-6 rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10 overflow-hidden">
                                    <div className="flex items-start gap-3 px-5 py-4">
                                        <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-rose-800 dark:text-rose-300 text-sm">Database setup required</h4>
                                            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1 leading-relaxed">
                                                The <code className="font-mono bg-rose-100 dark:bg-rose-900/40 px-1 rounded">assignments</code> and <code className="font-mono bg-rose-100 dark:bg-rose-900/40 px-1 rounded">class_notes</code> tables don&apos;t exist yet in your <strong>auth Supabase project</strong> (<code className="font-mono">sevtycwrmhzyfxvxkkgc</code>).
                                            </p>
                                            <p className="text-xs text-rose-700 dark:text-rose-400 mt-2">
                                                Go to <strong>Supabase Dashboard → sevtycwrmhzyfxvxkkgc → SQL Editor → New Query</strong> and paste the SQL below, then click Run.
                                            </p>
                                        </div>
                                        <button onClick={() => setDbSetupError(false)} className="p-1 rounded text-rose-400 hover:text-rose-600 flex-shrink-0"><X className="w-4 h-4" /></button>
                                    </div>
                                    <div className="mx-5 mb-4 relative">
                                        <pre className="text-[10px] font-mono bg-rose-900/10 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 p-4 rounded-xl overflow-x-auto leading-relaxed border border-rose-200 dark:border-rose-800 max-h-40 overflow-y-auto">{`-- Run in: Supabase Dashboard > sevtycwrmhzyfxvxkkgc > SQL Editor
CREATE TABLE IF NOT EXISTS public.class_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL, teacher_id UUID NOT NULL,
  title TEXT NOT NULL, content TEXT, file_url TEXT,
  file_name TEXT, file_size INTEGER, color TEXT DEFAULT 'yellow',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL, teacher_id UUID NOT NULL,
  title TEXT NOT NULL, description TEXT, due_date DATE,
  target_type TEXT NOT NULL DEFAULT 'all',
  file_url TEXT, file_name TEXT, file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.assignment_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL, student_id UUID NOT NULL,
  status TEXT DEFAULT 'pending', UNIQUE (assignment_id, student_id)
);
ALTER TABLE public.class_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all class_notes" ON public.class_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all assignment_students" ON public.assignment_students FOR ALL USING (true) WITH CHECK (true);`}</pre>
                                        <button
                                            onClick={() => {
                                                const sql = `CREATE TABLE IF NOT EXISTS public.class_notes (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  classroom_id UUID NOT NULL, teacher_id UUID NOT NULL,\n  title TEXT NOT NULL, content TEXT, file_url TEXT,\n  file_name TEXT, file_size INTEGER, color TEXT DEFAULT 'yellow',\n  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()\n);\nCREATE TABLE IF NOT EXISTS public.assignments (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  classroom_id UUID NOT NULL, teacher_id UUID NOT NULL,\n  title TEXT NOT NULL, description TEXT, due_date DATE,\n  target_type TEXT NOT NULL DEFAULT 'all',\n  file_url TEXT, file_name TEXT, file_size INTEGER,\n  created_at TIMESTAMPTZ DEFAULT now()\n);\nCREATE TABLE IF NOT EXISTS public.assignment_students (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  assignment_id UUID NOT NULL, student_id UUID NOT NULL,\n  status TEXT DEFAULT 'pending', UNIQUE (assignment_id, student_id)\n);\nALTER TABLE public.class_notes ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;\nALTER TABLE public.assignment_students ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Allow all class_notes" ON public.class_notes FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);\nCREATE POLICY "Allow all assignment_students" ON public.assignment_students FOR ALL USING (true) WITH CHECK (true);`;
                                                navigator.clipboard.writeText(sql).then(() => alert('SQL copied to clipboard!'));
                                            }}
                                            className="absolute top-2 right-2 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg transition-colors"
                                        >
                                            Copy SQL
                                        </button>
                                    </div>
                                    <div className="px-5 pb-4">
                                        <button
                                            onClick={() => { setDbSetupError(false); fetchAssignments(); fetchClassNotes(); }}
                                            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors"
                                        >
                                            <Loader2 className="w-3.5 h-3.5" /> Retry after running SQL
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── Main Two-Panel Layout ─────────────────────────────────── */}
                            <div className="flex flex-col xl:flex-row gap-6">

                                {/* ══ LEFT: Notes Board ══════════════════════════════════════ */}
                                <div className="xl:w-96 flex-shrink-0 space-y-4">
                                    {/* Board Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <NotebookPen className="w-5 h-5 text-[#ecb613]" />
                                            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Notes Board</h3>
                                            {classNotes.length > 0 && (
                                                <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{classNotes.length}</span>
                                            )}
                                        </div>
                                        <button
                                            id="new-note-btn"
                                            onClick={openNewNote}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ecb613] text-slate-900 font-bold text-xs hover:bg-[#ecb613]/90 shadow-sm shadow-[#ecb613]/20 transition-all"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            New Note
                                        </button>
                                    </div>

                                    {/* Notes List */}
                                    {notesLoading ? (
                                        <div className="flex items-center justify-center py-16">
                                            <Loader2 className="w-7 h-7 animate-spin text-[#ecb613]" />
                                        </div>
                                    ) : classNotes.length === 0 ? (
                                        <button
                                            onClick={openNewNote}
                                            className="w-full flex flex-col items-center justify-center gap-3 py-14 border-2 border-dashed border-amber-200 dark:border-amber-700/30 rounded-2xl bg-amber-50/50 dark:bg-amber-900/5 hover:bg-amber-50 dark:hover:bg-amber-900/10 hover:border-amber-300 dark:hover:border-amber-600/50 transition-all group cursor-pointer text-center"
                                        >
                                            <StickyNote className="w-10 h-10 text-amber-300 dark:text-amber-600 group-hover:scale-110 transition-transform" />
                                            <div>
                                                <p className="font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200">No notes yet</p>
                                                <p className="text-xs text-slate-400 mt-1">Click to write your first class note</p>
                                            </div>
                                        </button>
                                    ) : (
                                        <div className="space-y-3">
                                            {classNotes.map(note => {
                                                const palette = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
                                                return (
                                                    <div
                                                        key={note.id}
                                                        draggable="true"
                                                        onDragStart={(e) => handleDragStart(e, note)}
                                                        className={`rounded-2xl border overflow-hidden shadow-sm group transition-shadow hover:shadow-md cursor-grab active:cursor-grabbing ${palette.bg} ${palette.border}`}
                                                    >
                                                        {/* Note header bar */}
                                                        <div className={`flex items-center justify-between px-4 py-2.5 ${palette.header}`}>
                                                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                                <GripVertical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 cursor-grab active:cursor-grabbing opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate flex-1">{note.title}</h4>
                                                             </div>
                                                             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                                <button
                                                                    onClick={() => openEditNote(note)}
                                                                    className="p-1.5 rounded-lg bg-white/70 dark:bg-slate-700/70 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                                                    title="Edit note"
                                                                >
                                                                    <Edit3 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteNote(note.id)}
                                                                    disabled={deletingNoteId === note.id}
                                                                    className="p-1.5 rounded-lg bg-white/70 dark:bg-slate-700/70 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
                                                                    title="Delete note"
                                                                >
                                                                    {deletingNoteId === note.id
                                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                                                        : <Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Note body */}
                                                        <div className="px-4 py-3">
                                                            {note.content && (
                                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-4">{note.content}</p>
                                                            )}
                                                            {/* File chip */}
                                                            {note.file_url && (
                                                                <a
                                                                    href={note.file_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-[#ecb613]/50 hover:text-[#ecb613] transition-all max-w-full"
                                                                >
                                                                    <Download className="w-3 h-3 flex-shrink-0" />
                                                                    <span className="truncate">{note.file_name || 'Attachment'}</span>
                                                                    {note.file_size && <span className="text-slate-400 flex-shrink-0">· {formatFileSize(note.file_size)}</span>}
                                                                </a>
                                                            )}
                                                            {/* Timestamp */}
                                                            <p className="mt-2.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                                                {new Date(note.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* ══ RIGHT: Assignments Panel ════════════════════════════════ */}
                                <div 
                                    className="flex-1 min-w-0 space-y-4 relative"
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'copy';
                                    }}
                                    onDragEnter={(e) => {
                                        e.preventDefault();
                                        if (e.dataTransfer.types.includes('application/json')) {
                                            setIsDraggingOverAssignments(true);
                                        }
                                    }}
                                >
                                    {isDraggingOverAssignments && (
                                        <div 
                                            className="absolute inset-0 z-50 bg-amber-500/10 dark:bg-amber-500/5 border-3 border-dashed border-[#ecb613] rounded-2xl flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] transition-all animate-in fade-in zoom-in-95 duration-200"
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                setIsDraggingOverAssignments(false);
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setIsDraggingOverAssignments(false);
                                                handleDropNote(e);
                                            }}
                                        >
                                            <div className="w-14 h-14 rounded-full bg-[#ecb613]/20 flex items-center justify-center text-[#ecb613] animate-bounce shadow-md">
                                                <ClipboardList className="w-7 h-7" />
                                            </div>
                                            <p className="font-extrabold text-[#ecb613] text-sm dark:text-[#ecb613] tracking-wide">Drop Note to Create Assignment</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center px-6">
                                                Release to configure options and assign to everyone or individuals.
                                            </p>
                                        </div>
                                    )}
                                    {/* Panel Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <ClipboardList className="w-5 h-5 text-[#ecb613]" />
                                            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Assignments</h3>
                                            {assignments.length > 0 && (
                                                <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{assignments.length}</span>
                                            )}
                                        </div>
                                        <button
                                            id="new-assignment-btn"
                                            onClick={() => setShowAssignmentModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ecb613] text-slate-900 font-bold text-sm hover:bg-[#ecb613]/90 shadow-md shadow-[#ecb613]/20 transition-all self-start"
                                        >
                                            <Plus className="w-4 h-4" />
                                            New Assignment
                                        </button>
                                    </div>

                                    {/* Filter Tabs */}
                                    <div className="flex items-center gap-2">
                                        {([['all', 'All', Filter], ['all_students', '👥 For Everyone', UsersRound], ['individual', '👤 Individual', User]] as const).map(([value, label, Icon]) => (
                                            <button
                                                key={value}
                                                onClick={() => setAssignmentFilter(value)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                                    assignmentFilter === value
                                                        ? 'bg-[#ecb613]/10 text-[#ecb613] border-[#ecb613]/40'
                                                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Assignment Cards */}
                                    {assignmentsLoading ? (
                                        <div className="flex items-center justify-center py-20">
                                            <Loader2 className="w-8 h-8 animate-spin text-[#ecb613]" />
                                        </div>
                                    ) : filteredAssignments.length === 0 ? (
                                        <button
                                            onClick={() => setShowAssignmentModal(true)}
                                            className="w-full flex flex-col items-center justify-center gap-3 py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-300 transition-all group cursor-pointer text-center"
                                        >
                                            <ClipboardList className="w-10 h-10 text-slate-300 dark:text-slate-600 group-hover:scale-110 transition-transform" />
                                            <div>
                                                <p className="font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">
                                                    {assignmentFilter !== 'all' ? 'No assignments match this filter.' : 'No assignments yet'}
                                                </p>
                                                {assignmentFilter === 'all' && <p className="text-xs text-slate-400 mt-1">Click to create your first assignment</p>}
                                            </div>
                                        </button>
                                    ) : (
                                        <div className="space-y-3">
                                            {filteredAssignments.map(asg => {
                                                const isExpanded = expandedAssignmentId === asg.id;
                                                const isDeleting = deletingAssignmentId === asg.id;
                                                const isDue = asg.due_date && new Date(asg.due_date) < new Date();
                                                return (
                                                    <div
                                                        key={asg.id}
                                                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-shadow hover:shadow-md"
                                                    >
                                                        {/* Card Header */}
                                                        <div className="px-5 py-4 flex items-start gap-3">
                                                            {/* Icon */}
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                                asg.target_type === 'all'
                                                                    ? 'bg-indigo-50 dark:bg-indigo-900/20'
                                                                    : 'bg-amber-50 dark:bg-amber-900/20'
                                                            }`}>
                                                                {asg.target_type === 'all'
                                                                    ? <UsersRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                                                    : <User className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                                                            </div>

                                                            {/* Content */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{asg.title}</h4>
                                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                        asg.target_type === 'all'
                                                                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                    }`}>
                                                                        {asg.target_type === 'all' ? '👥 All Students' : `👤 Individual (${asg.assignment_students?.length ?? 0})`}
                                                                    </span>
                                                                    {asg.due_date && (
                                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                            isDue
                                                                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                                        }`}>
                                                                            <Calendar className="w-2.5 h-2.5" />
                                                                            {isDue ? 'Overdue · ' : 'Due · '}{new Date(asg.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {asg.description && (
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{asg.description}</p>
                                                                )}
                                                                {asg.file_url && (
                                                                    <a
                                                                        href={asg.file_url}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#ecb613] hover:underline"
                                                                    >
                                                                        <Paperclip className="w-3 h-3" />{asg.file_name}
                                                                    </a>
                                                                )}
                                                                <p className="text-[10px] text-slate-400 mt-1.5">
                                                                    Created {new Date(asg.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                </p>
                                                            </div>

                                                            {/* Actions */}
                                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                                {asg.target_type === 'individual' && asg.assignment_students && asg.assignment_students.length > 0 && (
                                                                    <button
                                                                        onClick={() => setExpandedAssignmentId(isExpanded ? null : asg.id)}
                                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                        title={isExpanded ? 'Collapse' : 'Show students'}
                                                                    >
                                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDeleteAssignment(asg.id)}
                                                                    disabled={isDeleting}
                                                                    className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                                    title="Delete assignment"
                                                                >
                                                                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Expanded: Individual student list */}
                                                        {isExpanded && asg.assignment_students && asg.assignment_students.length > 0 && (
                                                            <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-5 py-4">
                                                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Assigned Students</p>
                                                                <div className="space-y-2">
                                                                    {asg.assignment_students.map(as => (
                                                                        <div key={as.id} className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                                                                            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                                                {as.student_pic
                                                                                    ? <img src={as.student_pic} alt={as.student_name} className="w-full h-full object-cover" />
                                                                                    : <span className="text-xs font-bold text-slate-500">{(as.student_name || 'U').charAt(0)}</span>
                                                                                }
                                                                            </div>
                                                                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1">{as.student_name || 'Unknown'}</span>
                                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusColors[as.status] || statusColors.pending}`}>
                                                                                {as.status}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'Attendance' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Attendance Header Controls */}
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                        <Calendar className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Class Attendance</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Mark or update student attendance for your class.</p>
                                    </div>
                                </div>
                                
                                {/* Date Navigation */}
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <button 
                                        onClick={() => {
                                            const prev = new Date(attendanceDate);
                                            prev.setDate(prev.getDate() - 1);
                                            setAttendanceDate(prev.toISOString().split('T')[0]);
                                        }}
                                        className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <input 
                                        type="date" 
                                        value={attendanceDate}
                                        onChange={(e) => setAttendanceDate(e.target.value)}
                                        className="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none px-2 text-center"
                                    />
                                    <button 
                                        onClick={() => {
                                            const next = new Date(attendanceDate);
                                            next.setDate(next.getDate() + 1);
                                            setAttendanceDate(next.toISOString().split('T')[0]);
                                        }}
                                        className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => setAttendanceDate(new Date().toISOString().split('T')[0])}
                                        className="px-3 py-1.5 bg-white dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600 shadow-sm"
                                    >
                                        Today
                                    </button>
                                </div>
                            </div>

                            {/* Summary Statistics */}
                            {(() => {
                                const activeRecords = Object.values(attendanceRecords);
                                const totalCount = students.length;
                                const presentCount = activeRecords.filter(r => r === 'present').length;
                                const lateCount = activeRecords.filter(r => r === 'late').length;
                                const absentCount = activeRecords.filter(r => r === 'absent').length;
                                const excusedCount = activeRecords.filter(r => r === 'excused').length;
                                const presentRate = totalCount > 0 ? Math.round(((presentCount + lateCount) / totalCount) * 100) : 0;
                                
                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Enrolled Students</p>
                                                <h4 className="text-2xl font-black text-slate-950 dark:text-white mt-1">{totalCount}</h4>
                                            </div>
                                            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl">
                                                <Users className="w-5 h-5" />
                                            </div>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Present / Late</p>
                                                <h4 className="text-2xl font-black text-slate-950 dark:text-white mt-1">
                                                    <span className="text-emerald-600">{presentCount}</span>
                                                    <span className="text-slate-400 mx-1">/</span>
                                                    <span className="text-amber-500">{lateCount}</span>
                                                </h4>
                                            </div>
                                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                                <CheckCircle className="w-5 h-5" />
                                            </div>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Absent / Excused</p>
                                                <h4 className="text-2xl font-black text-slate-950 dark:text-white mt-1">
                                                    <span className="text-rose-600">{absentCount}</span>
                                                    <span className="text-slate-400 mx-1">/</span>
                                                    <span className="text-slate-500">{excusedCount}</span>
                                                </h4>
                                            </div>
                                            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl">
                                                <X className="w-5 h-5" />
                                            </div>
                                        </div>
                                        <div className="bg-[#ecb613] p-5 rounded-2xl shadow-lg shadow-[#ecb613]/10 flex items-center justify-between text-slate-900">
                                            <div>
                                                <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Presence Rate</p>
                                                <h4 className="text-3xl font-black mt-1">{presentRate}%</h4>
                                            </div>
                                            <div className="p-3 bg-white/20 rounded-xl">
                                                <TrendingUp className="w-5 h-5 text-slate-950" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Attendance Table Card */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                {attendanceLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <Loader2 className="w-8 h-8 animate-spin text-[#ecb613] mb-2" />
                                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Syncing attendance logs...</p>
                                    </div>
                                ) : students.length > 0 ? (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {students.map((student) => {
                                            const status = attendanceRecords[student.student_id];
                                            const isSaving = isSavingAttendanceMap[student.student_id];
                                            return (
                                                <div 
                                                    key={student.id} 
                                                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all group"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-slate-50 dark:border-slate-700 shadow-inner group-hover:scale-105 transition-transform relative">
                                                            {student.profile_pic_url ? (
                                                                <img src={student.profile_pic_url} alt={student.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-[#ecb613] text-lg font-black">{student.name.charAt(0)}</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-extrabold text-slate-900 dark:text-white tracking-tight">{student.name}</h4>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Joined {new Date(student.joined_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                        </div>
                                                    </div>

                                                    {/* Custom Button Selectors */}
                                                    <div className="flex items-center gap-2 flex-wrap relative">
                                                        {isSaving && (
                                                            <div className="absolute -left-8 top-1/2 -translate-y-1/2">
                                                                <Loader2 className="w-4 h-4 animate-spin text-[#ecb613]" />
                                                            </div>
                                                        )}
                                                        
                                                        {([
                                                            { key: 'present', label: 'Present', color: 'emerald', border: 'border-emerald-200 dark:border-emerald-800', activeBg: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' },
                                                            { key: 'absent', label: 'Absent', color: 'rose', border: 'border-rose-200 dark:border-rose-800', activeBg: 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' },
                                                            { key: 'late', label: 'Late', color: 'amber', border: 'border-amber-200 dark:border-amber-800', activeBg: 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' },
                                                            { key: 'excused', label: 'Excused', color: 'slate', border: 'border-slate-200 dark:border-slate-700', activeBg: 'bg-slate-600 text-white shadow-lg shadow-slate-600/20' }
                                                        ] as const).map(opt => {
                                                            const isActive = status === opt.key;
                                                            return (
                                                                <button
                                                                    key={opt.key}
                                                                    disabled={isSaving}
                                                                    onClick={() => handleMarkClassroomAttendance(student.student_id, opt.key)}
                                                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                                                                        isActive 
                                                                            ? opt.activeBg
                                                                            : `border ${opt.border} bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800`
                                                                    }`}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="py-20 text-center">
                                        <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Enrolled Students</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Please enroll students in the Students tab first to mark their attendance.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : activeTab === 'Settings' ? (
                        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="p-8 border-b border-slate-200 dark:border-slate-800">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Classroom Settings</h3>
                                    <p className="text-sm text-slate-500 mt-1">Manage class details and recurring schedule timings.</p>
                                </div>
                                <div className="p-8 space-y-10">
                                    {/* Schedule Section */}
                                    <section>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                                <Clock className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Recurring Schedule</h4>
                                                <p className="text-xs text-slate-500">Set the weekly timings for this class.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* List of Schedules */}
                                            <div className="space-y-4">
                                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Active Slots</h5>
                                                {schedules.length === 0 ? (
                                                    <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                                        <p className="text-xs font-bold text-slate-400">No schedule slots configured yet.</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {schedules.map((slot) => (
                                                            <div key={slot.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl hover:shadow-md transition-all group">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                                                                        <Calendar className="w-5 h-5 text-[#ecb613]" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{DAY_NAMES[slot.day_of_week]}</p>
                                                                        <p className="text-xs font-medium text-slate-500">{formatTime12hr(slot.start_time)} - {formatTime12hr(slot.end_time)}</p>
                                                                    </div>
                                                                </div>
                                                                <button 
                                                                    onClick={() => handleDeleteSchedule(slot.id)}
                                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Add Schedule Form */}
                                            <div className="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Add New Timing</h5>
                                                <div className="space-y-5">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-2 px-1 uppercase tracking-wide">Day of the Week</label>
                                                        <select 
                                                            value={newSchedule.day}
                                                            onChange={(e) => setNewSchedule(prev => ({ ...prev, day: parseInt(e.target.value) }))}
                                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#ecb613] outline-none transition-all"
                                                        >
                                                            {DAY_NAMES.map((day, idx) => (
                                                                <option key={idx} value={idx}>{day}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 mb-2 px-1 uppercase tracking-wide">Start Time</label>
                                                            <select 
                                                                value={newSchedule.start}
                                                                onChange={(e) => setNewSchedule(prev => ({ ...prev, start: e.target.value }))}
                                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#ecb613] outline-none transition-all"
                                                            >
                                                                {TIME_OPTIONS.map(opt => (
                                                                    <option key={`start-${opt.value}`} value={opt.value}>{opt.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 mb-2 px-1 uppercase tracking-wide">End Time</label>
                                                            <select 
                                                                value={newSchedule.end}
                                                                onChange={(e) => setNewSchedule(prev => ({ ...prev, end: e.target.value }))}
                                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#ecb613] outline-none transition-all"
                                                            >
                                                                {TIME_OPTIONS.map(opt => (
                                                                    <option key={`end-${opt.value}`} value={opt.value}>{opt.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={handleSaveSchedule}
                                                        disabled={isSavingSchedule}
                                                        className="w-full bg-[#ecb613] text-slate-900 font-bold py-3 rounded-xl shadow-md shadow-[#ecb613]/20 hover:bg-[#ecb613]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                                                    >
                                                        {isSavingSchedule ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
                                                        Save Schedule Slot
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <hr className="border-slate-100 dark:border-slate-800" />

                                    {/* Class Details – Editable */}
                                    <section>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                                <Edit3 className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Class Details</h4>
                                                <p className="text-xs text-slate-500">Edit class name, description, and status.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            {/* Class Name */}
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                                                    Class Name <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={metadataForm.name}
                                                    onChange={e => setMetadataForm(prev => ({ ...prev, name: e.target.value }))}
                                                    placeholder="e.g. Morning Beginners Batch"
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                                                />
                                            </div>

                                            {/* Description */}
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Description</label>
                                                <textarea
                                                    rows={4}
                                                    value={metadataForm.description}
                                                    onChange={e => setMetadataForm(prev => ({ ...prev, description: e.target.value }))}
                                                    placeholder="Briefly describe the focus, level, or goals of this class…"
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all resize-none placeholder:text-slate-400"
                                                />
                                            </div>

                                            {/* Status */}
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Class Status</label>
                                                <div className="flex items-center gap-3">
                                                    {(['active', 'inactive', 'archived'] as const).map(s => (
                                                        <button
                                                            key={s}
                                                            type="button"
                                                            onClick={() => setMetadataForm(prev => ({ ...prev, status: s }))}
                                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-xs font-bold uppercase tracking-wide transition-all ${
                                                                metadataForm.status === s
                                                                    ? s === 'active'
                                                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                                                        : s === 'inactive'
                                                                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                                                        : 'border-slate-400 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                                    : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                                                            }`}
                                                        >
                                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                                s === 'active' ? 'bg-emerald-500' : s === 'inactive' ? 'bg-amber-400' : 'bg-slate-400'
                                                            }`} />
                                                            {s}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Error / Success feedback */}
                                            {metadataError && (
                                                <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
                                                    <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                                                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{metadataError}</p>
                                                </div>
                                            )}
                                            {metadataSaved && (
                                                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                                                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Changes saved successfully!</p>
                                                </div>
                                            )}

                                            {/* Action buttons */}
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                                                <button
                                                    type="button"
                                                    onClick={() => setMetadataForm({
                                                        name: classroom?.name || '',
                                                        description: classroom?.description || '',
                                                        status: classroom?.status || 'active',
                                                    })}
                                                    className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                                >
                                                    Reset changes
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSaveMetadata}
                                                    disabled={isSavingMetadata}
                                                    className="flex items-center gap-2 px-6 py-2.5 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 font-bold text-sm rounded-xl shadow-md shadow-[#ecb613]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    {isSavingMetadata
                                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                                                        : <><Edit3 className="w-4 h-4" /> Save Changes</>
                                                    }
                                                </button>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                            <div className="text-center">
                                <Lightbulb className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Coming Soon</h3>
                                <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">The {activeTab} section is currently under development. Please check back later.</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
