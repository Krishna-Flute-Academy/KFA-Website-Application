'use client';

import React, { useState, useEffect } from 'react';
import { supabaseAuth } from '../../../lib/supabase-auth';
import { ensureAlternativeSessionsForHolidayDate } from '../../../lib/alternative-class-sessions';
import { Calendar, AlertCircle, X, Clock, HelpCircle, Layers, CheckSquare } from 'lucide-react';

interface DeclareHolidayModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    classroomId?: string;
    classroomName?: string;
    initialDate?: string;
}

interface EligibleClassroom {
    id: string;
    name: string;
    scheduleTime: string;
}

export default function DeclareHolidayModal({
    isOpen,
    onClose,
    onSuccess,
    classroomId = '',
    classroomName = 'Select Classroom',
    initialDate = ''
}: DeclareHolidayModalProps) {
    const [holidayDate, setHolidayDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
    const [holidayType, setHolidayType] = useState<'no_alternative' | 'alternative_pending' | 'alternative_scheduled'>('alternative_pending');
    const [scope, setScope] = useState<'current' | 'all_scheduled' | 'selected'>('current');
    const [targetSingleRoomId, setTargetSingleRoomId] = useState<string>(classroomId || '');
    const [allRooms, setAllRooms] = useState<{ id: string; name: string }[]>([]);
    const [alternativeDate, setAlternativeDate] = useState('');
    const [altStartTime, setAltStartTime] = useState('');
    const [altEndTime, setAltEndTime] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Selected classrooms multi-selection state (Task 1)
    const [eligibleClassrooms, setEligibleClassrooms] = useState<EligibleClassroom[]>([]);
    const [selectedClassroomIds, setSelectedClassroomIds] = useState<string[]>(classroomId ? [classroomId] : []);
    const [loadingClassrooms, setLoadingClassrooms] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialDate) {
                setHolidayDate(initialDate);
            }
            if (classroomId) {
                setTargetSingleRoomId(classroomId);
                setScope('current');
            }
            setError(null);
        }
    }, [isOpen, initialDate, classroomId]);

    // Fetch eligible classrooms whenever holidayDate or isOpen changes
    useEffect(() => {
        if (!isOpen || !holidayDate) return;

        let isMounted = true;
        async function loadEligibleRooms() {
            setLoadingClassrooms(true);
            try {
                const [y, m, d] = holidayDate.split('-').map(Number);
                const dow = new Date(y, m - 1, d).getDay();

                const { data: { user } } = await supabaseAuth.auth.getUser();
                if (!user) return;

                const { data: userProfile } = await supabaseAuth
                    .from('users')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                const isAdmin = userProfile?.role === 'admin';

                let classQuery = supabaseAuth
                    .from('classrooms')
                    .select('id, name, teacher_id, type')
                    .eq('status', 'active');

                if (!isAdmin) {
                    classQuery = classQuery.eq('teacher_id', user.id);
                }

                const { data: rooms, error: roomErr } = await classQuery;
                if (roomErr) throw roomErr;

                const permanentRooms = (rooms || []).filter((r: any) => r.type !== 'temporary');

                if (permanentRooms.length === 0) {
                    if (isMounted) {
                        setAllRooms([]);
                        setEligibleClassrooms([]);
                    }
                    return;
                }

                if (isMounted) {
                    setAllRooms(permanentRooms.map((r: any) => ({ id: r.id, name: r.name })));
                }

                const roomIds = permanentRooms.map((r: any) => r.id);

                const { data: schedules, error: schedErr } = await supabaseAuth
                    .from('batch_schedules')
                    .select('classroom_id, start_time, end_time')
                    .eq('day_of_week', dow)
                    .in('classroom_id', roomIds);

                if (schedErr) throw schedErr;

                const schedMap = new Map<string, string>();
                for (const s of (schedules || [])) {
                    const start = s.start_time ? s.start_time.slice(0, 5) : '';
                    const end = s.end_time ? s.end_time.slice(0, 5) : '';
                    const timeStr = start && end ? `${start} - ${end}` : start || 'Scheduled';
                    schedMap.set(s.classroom_id, timeStr);
                }

                const eligible: EligibleClassroom[] = [];
                for (const r of permanentRooms) {
                    if (schedMap.has(r.id) || (classroomId && r.id === classroomId)) {
                        eligible.push({
                            id: r.id,
                            name: r.name,
                            scheduleTime: schedMap.get(r.id) || 'Current Classroom'
                        });
                    }
                }

                if (isMounted) {
                    setEligibleClassrooms(eligible);
                    setTargetSingleRoomId(prev => {
                        if (prev && permanentRooms.some((r: any) => r.id === prev)) return prev;
                        if (classroomId && permanentRooms.some((r: any) => r.id === classroomId)) return classroomId;
                        if (eligible.length > 0) return eligible[0].id;
                        return permanentRooms[0]?.id || '';
                    });
                    setSelectedClassroomIds(prev => {
                        const filtered = prev.filter(id => eligible.some(e => e.id === id));
                        return filtered.length > 0 ? filtered : (classroomId && eligible.some(e => e.id === classroomId) ? [classroomId] : (eligible[0] ? [eligible[0].id] : []));
                    });
                }
            } catch (err) {
                console.error('Error fetching eligible classrooms:', err);
            } finally {
                if (isMounted) setLoadingClassrooms(false);
            }
        }

        loadEligibleRooms();

        return () => {
            isMounted = false;
        };
    }, [isOpen, holidayDate, classroomId]);

    if (!isOpen) return null;

    const effectiveSingleRoomId = targetSingleRoomId || classroomId;
    const effectiveSingleRoomName =
        allRooms.find(r => r.id === effectiveSingleRoomId)?.name ||
        eligibleClassrooms.find(r => r.id === effectiveSingleRoomId)?.name ||
        classroomName ||
        'Selected Classroom';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const cleanReason = reason.trim();
        if (cleanReason.length < 3) {
            setError('Please provide a valid reason (minimum 3 characters).');
            return;
        }

        if (scope === 'current' && !effectiveSingleRoomId) {
            setError('Please select a classroom for the holiday declaration.');
            return;
        }

        if (scope === 'selected' && selectedClassroomIds.length === 0) {
            setError('Please select at least one classroom for the holiday declaration.');
            return;
        }

        if (holidayType === 'alternative_scheduled') {
            if (!alternativeDate) {
                setError('Please select an alternative class date.');
                return;
            }
            if (alternativeDate === holidayDate) {
                setError('Alternative date cannot be the same as the holiday date.');
                return;
            }
        }

        setLoading(true);
        try {
            if (scope === 'all_scheduled') {
                const { data, error: rpcError } = await supabaseAuth.rpc('declare_bulk_classroom_holidays', {
                    p_classroom_ids: [],
                    p_holiday_date: holidayDate,
                    p_holiday_type: holidayType,
                    p_reason: cleanReason,
                    p_default_alt_date: holidayType === 'alternative_scheduled' ? alternativeDate : null,
                    p_default_alt_start: holidayType === 'alternative_scheduled' && altStartTime ? `${altStartTime}:00` : null,
                    p_default_alt_end: holidayType === 'alternative_scheduled' && altEndTime ? `${altEndTime}:00` : null,
                    p_scope: 'all_scheduled'
                });

                if (rpcError) throw rpcError;
            } else if (scope === 'selected') {
                const { data, error: rpcError } = await supabaseAuth.rpc('declare_bulk_classroom_holidays', {
                    p_classroom_ids: selectedClassroomIds,
                    p_holiday_date: holidayDate,
                    p_holiday_type: holidayType,
                    p_reason: cleanReason,
                    p_default_alt_date: holidayType === 'alternative_scheduled' ? alternativeDate : null,
                    p_default_alt_start: holidayType === 'alternative_scheduled' && altStartTime ? `${altStartTime}:00` : null,
                    p_default_alt_end: holidayType === 'alternative_scheduled' && altEndTime ? `${altEndTime}:00` : null,
                    p_scope: 'selected'
                });

                if (rpcError) throw rpcError;
            } else {
                const { data, error: rpcError } = await supabaseAuth.rpc('declare_classroom_holiday', {
                    p_classroom_id: effectiveSingleRoomId,
                    p_holiday_date: holidayDate,
                    p_holiday_type: holidayType,
                    p_reason: cleanReason,
                    p_alternative_date: holidayType === 'alternative_scheduled' ? alternativeDate : null,
                    p_alt_start_time: holidayType === 'alternative_scheduled' && altStartTime ? `${altStartTime}:00` : null,
                    p_alt_end_time: holidayType === 'alternative_scheduled' && altEndTime ? `${altEndTime}:00` : null
                });

                if (rpcError) throw rpcError;
            }

            // BR-22: every scheduled alternative class is materialised as a Special Session
            if (holidayType === 'alternative_scheduled') {
                try {
                    await ensureAlternativeSessionsForHolidayDate(
                        supabaseAuth,
                        holidayDate,
                        scope === 'current' ? [effectiveSingleRoomId] : scope === 'selected' ? selectedClassroomIds : undefined
                    );
                } catch (sessErr) {
                    console.error('Error creating alternative class special session:', sessErr);
                }
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error declaring holiday:', err);
            setError(err?.message || 'Failed to declare holiday.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">Declare Classroom Holiday</h3>
                            <p className="text-xs text-amber-100 mt-0.5">
                                {scope === 'all_scheduled' ? 'All Scheduled Classrooms on Date' : scope === 'selected' ? `${selectedClassroomIds.length} Selected Classroom${selectedClassroomIds.length === 1 ? '' : 's'}` : effectiveSingleRoomName}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                        disabled={loading}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left overflow-y-auto max-h-[80vh]">
                    {error && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Scope Selector: 3 Modes */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Target Classrooms Scope (Single or Multiple Classes)
                        </label>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <button
                                type="button"
                                id="scopeCurrentBtn"
                                onClick={() => setScope('current')}
                                className={`px-2.5 py-2 rounded-xl border text-left font-semibold transition-all ${
                                    scope === 'current'
                                        ? 'border-amber-600 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-1 ring-amber-600/30'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <div className="truncate">Single Class</div>
                                <div className="text-[10px] font-normal text-slate-500 mt-0.5 truncate">{effectiveSingleRoomName}</div>
                            </button>
                            <button
                                type="button"
                                id="scopeAllScheduledBtn"
                                onClick={() => setScope('all_scheduled')}
                                className={`px-2.5 py-2 rounded-xl border text-left font-semibold transition-all ${
                                    scope === 'all_scheduled'
                                        ? 'border-amber-600 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-1 ring-amber-600/30'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <div className="flex items-center gap-1">
                                    <Layers className="w-3.5 h-3.5" />
                                    <span>All Scheduled</span>
                                </div>
                                <div className="text-[10px] font-normal text-slate-500 mt-0.5">Bulk all date</div>
                            </button>
                            <button
                                type="button"
                                id="scopeSelectedBtn"
                                onClick={() => setScope('selected')}
                                className={`px-2.5 py-2 rounded-xl border text-left font-semibold transition-all ${
                                    scope === 'selected'
                                        ? 'border-amber-600 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-1 ring-amber-600/30'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <div className="flex items-center gap-1">
                                    <CheckSquare className="w-3.5 h-3.5" />
                                    <span>Selected</span>
                                </div>
                                <div className="text-[10px] font-normal text-slate-500 mt-0.5">Multiple classes</div>
                            </button>
                        </div>
                    </div>

                    {/* Single Classroom Selector when scope === 'current' and multiple classrooms exist */}
                    {scope === 'current' && allRooms.length > 0 && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                Classroom *
                            </label>
                            <select
                                id="singleClassroomSelect"
                                value={effectiveSingleRoomId}
                                onChange={(e) => setTargetSingleRoomId(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium"
                            >
                                {allRooms.map(r => (
                                    <option key={r.id} value={r.id}>
                                        {r.name}{eligibleClassrooms.some(ec => ec.id === r.id) ? ' (Scheduled on Date)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Selected Classrooms Checkbox Multi-Selection Container (Task 1) */}
                    {scope === 'selected' && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                        Select Target Classrooms
                                    </span>
                                    <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full" id="selectedCountBadge">
                                        {selectedClassroomIds.length} of {eligibleClassrooms.length} selected
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        id="selectAllRoomsBtn"
                                        onClick={() => setSelectedClassroomIds(eligibleClassrooms.map(c => c.id))}
                                        className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-slate-300 dark:text-slate-600 text-xs">|</span>
                                    <button
                                        type="button"
                                        id="clearAllRoomsBtn"
                                        onClick={() => setSelectedClassroomIds([])}
                                        className="text-[10px] font-semibold text-slate-500 hover:underline"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {loadingClassrooms ? (
                                <div className="py-4 text-center text-xs text-slate-400">
                                    Loading eligible scheduled classrooms...
                                </div>
                            ) : eligibleClassrooms.length === 0 ? (
                                <div className="py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                                    No scheduled classrooms found on this date.
                                </div>
                            ) : (
                                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1" id="selectedRoomsList">
                                    {eligibleClassrooms.map((room) => {
                                        const isChecked = selectedClassroomIds.includes(room.id);
                                        return (
                                            <label
                                                key={room.id}
                                                className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                                    isChecked
                                                        ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 shadow-3xs'
                                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        value={room.id}
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedClassroomIds(prev => [...prev, room.id]);
                                                            } else {
                                                                setSelectedClassroomIds(prev => prev.filter(id => id !== room.id));
                                                            }
                                                        }}
                                                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                                    />
                                                    <span className="font-semibold truncate">
                                                        {room.name}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex-shrink-0 ml-2">
                                                    {room.scheduleTime}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Holiday Date */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Holiday Date (Original Class Cancelled) *
                        </label>
                        <input
                            id="holidayDate"
                            type="date"
                            value={holidayDate}
                            onChange={(e) => setHolidayDate(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                    </div>

                    {/* Holiday Type 3-State Toggle */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                            Holiday State
                        </label>
                        <div className="space-y-2">
                            {/* Option 1: Alternative Pending */}
                            <label
                                className={`cursor-pointer border rounded-xl p-3 flex items-start gap-3 transition-all ${
                                    holidayType === 'alternative_pending'
                                        ? 'border-amber-600 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 shadow-sm'
                                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="holiday_type"
                                    value="alternative_pending"
                                    checked={holidayType === 'alternative_pending'}
                                    onChange={() => setHolidayType('alternative_pending')}
                                    className="text-amber-600 focus:ring-amber-500 mt-0.5"
                                />
                                <div>
                                    <div className="font-bold text-xs">⏳ Alternative Pending (Schedule Later)</div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        Holiday is declared immediately. Replacement date and time can be confirmed later per classroom. 0 deduction now.
                                    </p>
                                </div>
                            </label>

                            {/* Option 2: Schedule Alternative Now */}
                            <label
                                className={`cursor-pointer border rounded-xl p-3 flex items-start gap-3 transition-all ${
                                    holidayType === 'alternative_scheduled'
                                        ? 'border-amber-600 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 shadow-sm'
                                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="holiday_type"
                                    value="alternative_scheduled"
                                    checked={holidayType === 'alternative_scheduled'}
                                    onChange={() => setHolidayType('alternative_scheduled')}
                                    className="text-amber-600 focus:ring-amber-500 mt-0.5"
                                />
                                <div>
                                    <div className="font-bold text-xs">📅 Schedule Alternative Now</div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        Replacement class date and time are already confirmed. Linked as On Behalf Of.
                                    </p>
                                </div>
                            </label>

                            {/* Option 3: No Alternative */}
                            <label
                                className={`cursor-pointer border rounded-xl p-3 flex items-start gap-3 transition-all ${
                                    holidayType === 'no_alternative'
                                        ? 'border-amber-600 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 shadow-sm'
                                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="holiday_type"
                                    value="no_alternative"
                                    checked={holidayType === 'no_alternative'}
                                    onChange={() => setHolidayType('no_alternative')}
                                    className="text-amber-600 focus:ring-amber-500 mt-0.5"
                                />
                                <div>
                                    <div className="font-bold text-xs">🏖️ No Alternative Class</div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        Holiday without replacement. 0 deduction. Unused credits remain preserved for regular future sessions.
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Alternative Class Details (Shown only for alternative_scheduled) */}
                    {holidayType === 'alternative_scheduled' && (
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3 animate-in fade-in duration-150">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                    Alternative Class Date *
                                </label>
                                <input
                                    type="date"
                                    value={alternativeDate}
                                    onChange={(e) => setAlternativeDate(e.target.value)}
                                    required={holidayType === 'alternative_scheduled'}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        Start Time (Optional)
                                    </label>
                                    <input
                                        type="time"
                                        value={altStartTime}
                                        onChange={(e) => setAltStartTime(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        End Time (Optional)
                                    </label>
                                    <input
                                        type="time"
                                        value={altEndTime}
                                        onChange={(e) => setAltEndTime(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reason */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                            Holiday Declaration Reason *
                        </label>
                        <textarea
                            id="holidayReason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Diwali Festival, Academy Annual Day, or Teacher Leave"
                            rows={2}
                            required
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                        />
                    </div>

                    {/* Financial & Operational Summary */}
                    <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-1 text-xs text-amber-900 dark:text-amber-200">
                        <div className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Financial Invariants Guaranteed</span>
                        </div>
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                            <li>Original session on {holidayDate || 'selected date'} is <strong>cancelled</strong> with <strong>0 credit deduction</strong>.</li>
                            <li><strong>Never creates a makeup entitlement</strong> merely because a holiday or pending alternative is declared.</li>
                            <li>Credit deduction (1 credit) occurs <strong>only when the replacement session is conducted and marked</strong>.</li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                        >
                            {loading ? 'Declaring...' : scope === 'all_scheduled' ? 'Declare Bulk Holiday' : 'Declare Holiday'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
