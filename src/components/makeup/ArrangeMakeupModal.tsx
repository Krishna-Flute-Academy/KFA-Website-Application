'use client';

import React, { useState, useEffect, useMemo, useId } from 'react';
import {
    X,
    Calendar,
    Clock,
    Users,
    Sparkles,
    Check,
    AlertCircle,
    Loader2,
    CalendarCheck,
    Radio,
    BookOpen,
    Video,
    MapPin,
    ArrowRight,
    Search
} from 'lucide-react';
import { supabaseAuth } from '../../lib/supabase-auth';
import {
    fetchAvailablePermanentClassrooms,
    scheduleMakeupInExistingClass,
    rescheduleMakeup,
    scheduleMakeupAsSpecialSession,
    getDayOfWeekFromDateStr,
    formatTime12hr,
    PermanentClassroomOption
} from '../../lib/makeup-sessions';

const getLocalTodayDate = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export interface ArrangeMakeupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (result?: any) => void;
    student: {
        id: string;
        name: string;
        email?: string;
        profile_pic_url?: string | null;
        level?: string;
    };
    missedSession: {
        date: string; // YYYY-MM-DD
        classroomId?: string;
        classroomName?: string;
    };
    existingOverrideId?: string;
    currentTeacherId?: string;
    isAdmin?: boolean;
    teachers?: Array<{ id: string; name: string; profile_pic_url?: string | null }>;
}

export const ArrangeMakeupModal: React.FC<ArrangeMakeupModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    student,
    missedSession,
    existingOverrideId,
    currentTeacherId,
    isAdmin = false,
    teachers = []
}) => {
    const radioGroupName = useId();
    // Mode: 'existing_class' vs 'special_session'
    const [makeupMode, setMakeupMode] = useState<'existing_class' | 'special_session'>('existing_class');

    // Loading & Error states
    const [isLoadingClassrooms, setIsLoadingClassrooms] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Pathway 1: Join Existing Class State
    const [permanentClassrooms, setPermanentClassrooms] = useState<PermanentClassroomOption[]>([]);
    const [activeAlternativeHolidays, setActiveAlternativeHolidays] = useState<any[]>([]);
    const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
    const [makeupDate, setMakeupDate] = useState<string>(getLocalTodayDate());
    const [existingNotes, setExistingNotes] = useState<string>('');

    // Pathway 2: Create Special Session State
    const [sessionTitle, setSessionTitle] = useState<string>(`Makeup Session - ${student?.name || 'Student'}`);
    const [sessionDate, setSessionDate] = useState<string>('');
    const [startTime, setStartTime] = useState<string>('17:00');
    const [endTime, setEndTime] = useState<string>('18:00');
    const [assignedTeacherId, setAssignedTeacherId] = useState<string>(currentTeacherId || '');
    const [deliveryFormat, setDeliveryFormat] = useState<'online' | 'offline'>('online');
    const [specialNotes, setSpecialNotes] = useState<string>('');

    // Format Missed Date for Display
    const formattedMissedDate = useMemo(() => {
        if (!missedSession.date) return 'Recorded Class';
        const [y, m, d] = missedSession.date.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        return dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }, [missedSession.date]);

    // Format Selected Makeup Date for Display
    const formattedSelectedDate = useMemo(() => {
        if (!makeupDate) return '';
        const [y, m, d] = makeupDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        return dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }, [makeupDate]);

    // Load available permanent classrooms on open
    useEffect(() => {
        if (!isOpen) return;

        setErrorMessage(null);
        setIsLoadingClassrooms(true);
        setSelectedClassroomId('');
        setExistingNotes('');

        const todayStr = getLocalTodayDate();
        setMakeupDate(todayStr);

        fetchAvailablePermanentClassrooms(supabaseAuth, currentTeacherId, isAdmin)
            .then(rooms => {
                setPermanentClassrooms(rooms);
            })
            .catch(err => {
                console.error('Failed to load classrooms:', err);
                setErrorMessage('Failed to load available classrooms.');
            })
            .finally(() => {
                setIsLoadingClassrooms(false);
            });

        // Load active alternative classes for permanent classrooms
        Promise.resolve(
            supabaseAuth
                .from('classroom_holidays')
                .select('classroom_id, holiday_date, alternative_date, alternative_start_time, alternative_end_time, holiday_type, status')
                .eq('status', 'active')
                .not('alternative_date', 'is', null)
        )
            .then(({ data }: any) => {
                const holidays = data || [];
                setActiveAlternativeHolidays(holidays);
            })
            .catch((err: any) => {
                console.error('Failed to load alternative holidays in makeup modal:', err);
            });

        // Pre-fill special session defaults
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tYear = tomorrow.getFullYear();
        const tMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const tDay = String(tomorrow.getDate()).padStart(2, '0');
        const tomorrowStr = `${tYear}-${tMonth}-${tDay}`;
        setSessionDate(tomorrowStr);
        setSessionTitle(`Makeup Session - ${student?.name || 'Student'}`);
        if (currentTeacherId) setAssignedTeacherId(currentTeacherId);

    }, [isOpen, currentTeacherId, isAdmin, student?.name]);

    // Available Classes for the selected date
    const availableClassesOnDate = useMemo(() => {
        if (!makeupDate) return [];
        const dayOfWeek = getDayOfWeekFromDateStr(makeupDate); // 0 (Sun) - 6 (Sat)

        // Find active alternative classes rescheduled to this date
        const altHolidays = (activeAlternativeHolidays || []).filter(
            (h: any) => h.alternative_date === makeupDate && h.status === 'active'
        );
        const altMap = new Map(altHolidays.map((h: any) => [h.classroom_id, h]));

        const results: Array<PermanentClassroomOption & { isAlternative: boolean; altTiming?: string }> = [];

        for (const room of permanentClassrooms) {
            if (room.isSpecialSession) {
                if (room.classDate === makeupDate) {
                    results.push({
                        ...room,
                        isAlternative: false
                    });
                }
            } else {
                const alt = altMap.get(room.id);
                if (alt) {
                    const altTiming = alt.alternative_start_time
                        ? `${formatTime12hr(alt.alternative_start_time)}${alt.alternative_end_time ? ' - ' + formatTime12hr(alt.alternative_end_time) : ''}`
                        : room.scheduleSummary;
                    results.push({
                        ...room,
                        isAlternative: true,
                        altTiming
                    });
                } else if (room.daysOfWeek && room.daysOfWeek.includes(dayOfWeek)) {
                    results.push({
                        ...room,
                        isAlternative: false
                    });
                }
            }
        }

        // Sort: Alternative classes first, then by name
        return results.sort((a, b) => {
            if (a.isAlternative && !b.isAlternative) return -1;
            if (!a.isAlternative && b.isAlternative) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [makeupDate, permanentClassrooms, activeAlternativeHolidays]);

    // Auto-select classroom when available classes update
    useEffect(() => {
        if (availableClassesOnDate.length > 0) {
            const currentStillValid = availableClassesOnDate.some(r => r.id === selectedClassroomId);
            if (!currentStillValid) {
                // Prefer alternative class if available, else first class
                const defaultPick = availableClassesOnDate.find(r => r.isAlternative) || availableClassesOnDate[0];
                setSelectedClassroomId(defaultPick.id);
            }
        } else {
            setSelectedClassroomId('');
        }
    }, [availableClassesOnDate, selectedClassroomId]);

    // Selected classroom metadata
    const selectedClassroom = useMemo(() => {
        return availableClassesOnDate.find(r => r.id === selectedClassroomId);
    }, [availableClassesOnDate, selectedClassroomId]);

    // Submit handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setIsSubmitting(true);

        try {
            if (makeupMode === 'existing_class') {
                if (!makeupDate) {
                    throw new Error('Please select a makeup class date.');
                }
                if (!selectedClassroomId) {
                    throw new Error(`Please select an available class on ${formattedSelectedDate || 'this date'}.`);
                }

                let res;
                if (existingOverrideId) {
                    res = await rescheduleMakeup(supabaseAuth, {
                        overrideId: existingOverrideId,
                        newTargetClassroomId: selectedClassroomId,
                        newMakeupDate: makeupDate,
                        missedSessionDate: missedSession.date,
                        notes: existingNotes
                    });
                } else {
                    res = await scheduleMakeupInExistingClass(supabaseAuth, {
                        studentId: student.id,
                        targetClassroomId: selectedClassroomId,
                        makeupDate,
                        missedSessionDate: missedSession.date,
                        notes: existingNotes,
                        studentName: student.name
                    });
                }

                onSuccess(res);
                onClose();

            } else {
                // Special Session
                if (!sessionTitle.trim()) {
                    throw new Error('Please enter a session title.');
                }
                if (!sessionDate) {
                    throw new Error('Please enter a session date.');
                }
                if (!startTime || !endTime) {
                    throw new Error('Please provide start and end times.');
                }
                if (endTime <= startTime) {
                    throw new Error('End time must be after start time.');
                }
                const teacherToUse = assignedTeacherId || currentTeacherId;
                if (!teacherToUse) {
                    throw new Error('Please select an instructor for this session.');
                }

                const res = await scheduleMakeupAsSpecialSession(supabaseAuth, {
                    studentId: student.id,
                    missedSessionDate: missedSession.date,
                    sessionDate,
                    startTime,
                    endTime,
                    teacherId: teacherToUse,
                    title: sessionTitle,
                    notes: specialNotes,
                    deliveryFormat
                });

                onSuccess(res);
                onClose();
            }
        } catch (err: any) {
            console.error('Error arranging makeup:', err);
            const rawMsg = err.message || 'Failed to arrange makeup session.';
            const userMsg = student?.name && student?.id && rawMsg.includes(student.id)
                ? rawMsg.replaceAll(student.id, student.name)
                : rawMsg;
            setErrorMessage(userMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden text-left animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0 bg-slate-50/70 dark:bg-slate-850/50">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="size-11 rounded-xl bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-800 dark:text-amber-300 font-bold overflow-hidden shrink-0 shadow-xs">
                            {student.profile_pic_url ? (
                                <img src={student.profile_pic_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span>{student.name.charAt(0)}</span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                    Arrange Makeup Session
                                </h3>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                                    1 Class Credit
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                For <strong className="text-slate-700 dark:text-slate-200 font-semibold">{student.name}</strong> • Missed on {formattedMissedDate}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                        aria-label="Close modal"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                    {/* Error Banner */}
                    {errorMessage && (
                        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                            <AlertCircle className="size-4 shrink-0 mt-0.5" />
                            <div className="flex-1 font-medium">{errorMessage}</div>
                        </div>
                    )}

                    {/* Mode Selection Segmented Bar */}
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
                        <button
                            type="button"
                            onClick={() => setMakeupMode('existing_class')}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                makeupMode === 'existing_class'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Users className="size-3.5 text-amber-500" />
                            <span>Join Class on Date</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMakeupMode('special_session')}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                makeupMode === 'special_session'
                                    ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Sparkles className="size-3.5 text-purple-500" />
                            <span>Create Special 1-on-1 Session</span>
                        </button>
                    </div>

                    {/* ──────────────────────────────────────────────────────────── */}
                    {/* PATHWAY 1: JOIN EXISTING CLASS FIELDS                         */}
                    {/* ──────────────────────────────────────────────────────────── */}
                    {makeupMode === 'existing_class' && (
                        <div className="space-y-4 pt-1 animate-in fade-in-50 duration-150">
                            {/* Step 1: Makeup Attendance Date */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        1. Makeup Attendance Date <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-medium">Select class date</span>
                                </div>

                                {/* Date Input */}
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-2.5 size-4 text-slate-400 pointer-events-none" />
                                    <input
                                        type="date"
                                        value={makeupDate}
                                        onChange={(e) => setMakeupDate(e.target.value)}
                                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#ecb613]/50 transition-all cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Step 2: Available Classes on Selected Date */}
                            <div className="space-y-2 pt-1">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        2. Available Classes on {formattedSelectedDate || 'Selected Date'} <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        {availableClassesOnDate.length} {availableClassesOnDate.length === 1 ? 'class' : 'classes'} found
                                    </span>
                                </div>

                                {isLoadingClassrooms ? (
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center gap-2 text-xs text-slate-400">
                                        <Loader2 className="size-3.5 animate-spin" />
                                        <span>Loading available classes...</span>
                                    </div>
                                ) : availableClassesOnDate.length === 0 ? (
                                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
                                        <p className="font-bold flex items-center gap-1.5">
                                            <AlertCircle className="size-3.5 shrink-0" />
                                            <span>No classes scheduled on {formattedSelectedDate || 'this date'}.</span>
                                        </p>
                                        <p className="text-[11px] text-amber-700 dark:text-amber-400 pl-5">
                                            Please pick another date above, or switch to <strong>"Create Special Session"</strong> to schedule a custom 1-on-1 class.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                        {availableClassesOnDate.map((room) => {
                                            const isSelected = selectedClassroomId === room.id;
                                            return (
                                                <div
                                                    key={room.id}
                                                    onClick={() => setSelectedClassroomId(room.id)}
                                                    className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                                                        isSelected
                                                            ? room.isAlternative
                                                                ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/30 ring-2 ring-amber-500/40'
                                                                : 'border-[#ecb613] bg-[#ecb613]/10 dark:bg-[#ecb613]/10 ring-2 ring-[#ecb613]/30'
                                                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850/40'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                                                            {room.isAlternative ? (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-900 flex items-center gap-1">
                                                                    <Sparkles className="size-2.5" />
                                                                    Alternative Session
                                                                </span>
                                                            ) : room.isSpecialSession ? (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500 text-white">
                                                                    Special
                                                                </span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                                                    Regular Batch
                                                                </span>
                                                            )}
                                                            <span>{room.name}</span>
                                                        </div>
                                                        <div className={`size-4 rounded-full flex items-center justify-center shrink-0 ${
                                                            isSelected
                                                                ? 'bg-[#ecb613] text-slate-900'
                                                                : 'border border-slate-300 dark:border-slate-600'
                                                        }`}>
                                                            {isSelected && <Check className="size-2.5 stroke-[3]" />}
                                                        </div>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex flex-wrap items-center gap-2">
                                                        <span>Instructor: <strong className="text-slate-700 dark:text-slate-300">{room.teacherName}</strong></span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="size-3 text-slate-400" />
                                                            <span>{room.isAlternative && room.altTiming ? room.altTiming : room.scheduleSummary}</span>
                                                        </span>
                                                        {!room.isSpecialSession && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{room.enrolledCount} enrolled</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Step 3: Notes / Reason */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Reason / Notes <span className="text-slate-400 font-normal">(Optional)</span>
                                </label>
                                <textarea
                                    value={existingNotes}
                                    onChange={(e) => setExistingNotes(e.target.value)}
                                    rows={2}
                                    placeholder="e.g. Attending alternative slot to cover missed class"
                                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-normal text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#ecb613]/50 transition-all resize-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* ──────────────────────────────────────────────────────────── */}
                    {/* PATHWAY 2: CREATE SPECIAL SESSION FIELDS                      */}
                    {/* ──────────────────────────────────────────────────────────── */}
                    {makeupMode === 'special_session' && (
                        <div className="space-y-4 pt-1 animate-in fade-in-50 duration-150">
                            {/* Session Title */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Session Title <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={sessionTitle}
                                    onChange={(e) => setSessionTitle(e.target.value)}
                                    placeholder="e.g. 1-on-1 Makeup: Raag Yaman Basics"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                />
                            </div>

                            {/* Date and Time Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Date <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={sessionDate}
                                        onChange={(e) => setSessionDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Start Time <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        End Time <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Instructor Selector (if Admin or teachers available) */}
                            {isAdmin && teachers.length > 0 && (
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Assigned Instructor <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={assignedTeacherId}
                                        onChange={(e) => setAssignedTeacherId(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all cursor-pointer"
                                    >
                                        {teachers.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Delivery Format */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Delivery Format
                                </label>
                                <div className="flex gap-3">
                                    <label className={`flex-1 p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition-all ${
                                        deliveryFormat === 'online'
                                            ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="deliveryFormat"
                                            value="online"
                                            checked={deliveryFormat === 'online'}
                                            onChange={() => setDeliveryFormat('online')}
                                            className="sr-only"
                                        />
                                        <Video className="size-3.5" />
                                        <span>Online Meeting</span>
                                    </label>
                                    <label className={`flex-1 p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition-all ${
                                        deliveryFormat === 'offline'
                                            ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="deliveryFormat"
                                            value="offline"
                                            checked={deliveryFormat === 'offline'}
                                            onChange={() => setDeliveryFormat('offline')}
                                            className="sr-only"
                                        />
                                        <MapPin className="size-3.5" />
                                        <span>In-Person Academy</span>
                                    </label>
                                </div>
                            </div>

                            {/* Notes Input */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Session Agenda / Notes <span className="text-slate-400 font-normal">(Optional)</span>
                                </label>
                                <textarea
                                    value={specialNotes}
                                    onChange={(e) => setSpecialNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Topics to cover during this makeup session..."
                                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-normal text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* Security & RLS Compliance Notice */}
                    <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {makeupMode === 'existing_class' ? (
                            <span>
                                🛡️ <strong>Attendance Guarantee:</strong> The student is granted a 1-day guest pass. They will appear on the teacher's attendance sheet on {makeupDate || 'the selected date'} with a <span className="font-bold text-amber-600">GUEST • MAKEUP</span> badge. They will <strong>not</strong> gain access to permanent classroom chat or assignments.
                            </span>
                        ) : (
                            <span>
                                🛡️ <strong>Special Session Architecture:</strong> Creates a dedicated one-off session. On completion, 1 missed class credit is automatically fulfilled and reconciled in the student's fee cycle.
                            </span>
                        )}
                    </div>

                    {/* Footer Buttons */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (makeupMode === 'existing_class' && (!selectedClassroomId || !makeupDate))}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                                makeupMode === 'existing_class'
                                    ? 'bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 shadow-[#ecb613]/20'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20'
                            }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Booking Makeup...</span>
                                </>
                            ) : (
                                <>
                                    <span>Confirm Makeup Booking</span>
                                    <ArrowRight className="size-3.5" />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
