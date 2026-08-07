'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Clock, Calendar, Video, Laptop, CalendarDays, ArrowRight } from 'lucide-react';

interface BatchSchedule {
    id: string;
    classroom_id: string;
    classroom_name: string;
    classroom_description?: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
}

interface TemporaryClass {
    id: string;
    classroom_id: string | null;
    classroom_name: string;
    classroom_description?: string;
    title: string;
    class_date: string;
    start_time: string;
    end_time: string;
}

interface ClassTimingsTableWidgetProps {
    classroomSchedules: BatchSchedule[];
    temporaryClasses: TemporaryClass[];
    classroomStudents: Record<string, string[]>;
    tempClassOverrides: Record<string, { override_date: string, student_name: string }[]>;
}

const DAYS_OF_WEEK = [
    { value: 1, label: 'Monday', short: 'Mon' },
    { value: 2, label: 'Tuesday', short: 'Tue' },
    { value: 3, label: 'Wednesday', short: 'Wed' },
    { value: 4, label: 'Thursday', short: 'Thu' },
    { value: 5, label: 'Friday', short: 'Fri' },
    { value: 6, label: 'Saturday', short: 'Sat' },
    { value: 0, label: 'Sunday', short: 'Sun' }
];

// Local 12hr time formatter
function formatTime12hr(time24: string) {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${m} ${ampm}`;
}

// Local date parser to get day of week in local time (avoiding UTC offset bugs)
function getDayOfWeekFromDate(dateStr: string) {
    if (!dateStr) return -1;
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getDay();
}

export default function ClassTimingsTableWidget({
    classroomSchedules = [],
    temporaryClasses = [],
    classroomStudents = {},
    tempClassOverrides = {}
}: ClassTimingsTableWidgetProps) {
    const todayDow = new Date().getDay();
    const [selectedDay, setSelectedDay] = useState<number>(todayDow);
    const [searchQuery, setSearchQuery] = useState('');
    const [formatFilter, setFormatFilter] = useState<'all' | 'online' | 'offline'>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'permanent' | 'temporary'>('all');

    // Aggregate schedules for the selected day of week
    const classesForDay = useMemo(() => {
        // 1. Filter recurring schedules
        const recurringRows = classroomSchedules
            .filter(sch => sch.day_of_week === selectedDay)
            .map(sch => {
                const isOnline = sch.classroom_description?.includes('[delivery_format:online]') ?? false;
                const students = classroomStudents[sch.classroom_id] || [];
                return {
                    id: `rec-${sch.id}`,
                    classroom_id: sch.classroom_id,
                    name: sch.classroom_name,
                    start_time: sch.start_time,
                    end_time: sch.end_time,
                    isOnline,
                    isPermanent: true,
                    students,
                    displayType: 'Permanent',
                    displayDate: null
                };
            });

        // 2. Filter temporary schedules that fall on this day of week
        const tempRows = temporaryClasses
            .filter(t => t.class_date && getDayOfWeekFromDate(t.class_date) === selectedDay)
            .map(t => {
                const isOnline = t.classroom_description?.includes('[delivery_format:online]') ?? false;
                
                // Fetch override student names for this class & date
                let students: string[] = [];
                if (t.classroom_id) {
                    const overrides = tempClassOverrides[t.classroom_id] || [];
                    students = overrides
                        .filter(ov => ov.override_date === t.class_date)
                        .map(ov => ov.student_name);
                    
                    // Fall back to classroom roster if no specific overrides exist
                    if (students.length === 0) {
                        students = classroomStudents[t.classroom_id] || [];
                    }
                }

                let dateLabel = '';
                if (t.class_date) {
                    const [y, m, d] = t.class_date.split('-').map(Number);
                    const dateObj = new Date(y, m - 1, d);
                    dateLabel = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                }

                return {
                    id: `temp-${t.id}`,
                    classroom_id: t.classroom_id,
                    name: t.classroom_name || t.title,
                    start_time: t.start_time,
                    end_time: t.end_time,
                    isOnline,
                    isPermanent: false,
                    students,
                    displayType: 'Temporary',
                    displayDate: dateLabel
                };
            });

        const combined = [...recurringRows, ...tempRows];
        // Sort chronologically by start time
        combined.sort((a, b) => a.start_time.localeCompare(b.start_time));
        return combined;
    }, [selectedDay, classroomSchedules, temporaryClasses, classroomStudents, tempClassOverrides]);

    // Filter rows based on query & selected filters
    const filteredRows = useMemo(() => {
        return classesForDay.filter(row => {
            // Delivery filter
            if (formatFilter === 'online' && !row.isOnline) return false;
            if (formatFilter === 'offline' && row.isOnline) return false;

            // Type filter
            if (typeFilter === 'permanent' && !row.isPermanent) return false;
            if (typeFilter === 'temporary' && row.isPermanent) return false;

            // Search filter
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const matchesClass = row.name.toLowerCase().includes(query);
                const matchesStudents = row.students.some(s => s.toLowerCase().includes(query));
                if (!matchesClass && !matchesStudents) return false;
            }

            return true;
        });
    }, [classesForDay, formatFilter, typeFilter, searchQuery]);

    // Renders list of students as clean badge pills
    const renderStudentsList = (students: string[]) => {
        if (students.length === 0) {
            return <span className="text-xs text-slate-400 dark:text-slate-500 italic">No students assigned</span>;
        }

        return (
            <div className="flex flex-wrap gap-1 max-w-[400px]">
                {students.slice(0, 3).map((s, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                        {s}
                    </span>
                ))}
                {students.length > 3 && (
                    <span 
                        className="inline-flex items-center px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold cursor-help"
                        title={students.slice(3).join(', ')}
                    >
                        +{students.length - 3} more
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs text-left flex flex-col transition-all">
            {/* Header Area */}
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-amber-500/5 to-orange-500/5 dark:from-amber-500/10 dark:to-orange-500/5">
                <div className="flex items-center gap-3">
                    <div className="size-9 bg-[#ecb613]/10 dark:bg-[#ecb613]/20 text-[#ecb613] rounded-xl flex items-center justify-center shadow-xs">
                        <CalendarDays className="size-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">Class Timings & Student Rosters</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Search daily class timings, delivery formats, and student assignments by day of the week.
                        </p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 sm:p-6 space-y-6">
                {/* Segmented Day Tabs */}
                <div className="flex overflow-x-auto scrollbar-none gap-1.5 border-b border-slate-100 dark:border-slate-800/50 pb-4 w-full snap-x">
                    {DAYS_OF_WEEK.map((day) => {
                        const isActive = selectedDay === day.value;
                        const isToday = todayDow === day.value;
                        return (
                            <button
                                key={day.value}
                                onClick={() => setSelectedDay(day.value)}
                                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 snap-start ${
                                    isActive
                                        ? 'bg-[#ecb613] text-slate-900 shadow-md shadow-[#ecb613]/10 scale-102 font-extrabold'
                                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                            >
                                <span>{day.label}</span>
                                {isToday && (
                                    <span className={`size-1.5 rounded-full ${isActive ? 'bg-slate-900' : 'bg-[#ecb613] animate-pulse'}`} />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    {/* Search Input */}
                    <div className="relative md:col-span-2">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 size-4.5" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search class or student name..."
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#ecb613] focus:border-transparent outline-none transition-all shadow-xs"
                        />
                    </div>

                    {/* Class Format Selector */}
                    <div>
                        <select
                            value={formatFilter}
                            onChange={(e) => setFormatFilter(e.target.value as any)}
                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#ecb613] outline-none shadow-xs"
                        >
                            <option value="all">All Delivery Formats</option>
                            <option value="online">Online Classes</option>
                            <option value="offline">Offline (In-Person)</option>
                        </select>
                    </div>

                    {/* Class Type Selector */}
                    <div>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as any)}
                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#ecb613] outline-none shadow-xs"
                        >
                            <option value="all">All Schedules</option>
                            <option value="permanent">Permanent Slots</option>
                            <option value="temporary">Temporary / Makeup</option>
                        </select>
                    </div>
                </div>

                {/* Table Container */}
                <div className="border border-slate-150 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-slate-900 dark:text-slate-100">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-955/50 border-b border-slate-150 dark:border-slate-800 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none">
                                    <th className="px-5 py-3.5 w-14 text-center">SlNo.</th>
                                    <th className="px-5 py-3.5 min-w-[150px]">Class Details</th>
                                    <th className="px-5 py-3.5 min-w-[180px]">Class Timings</th>
                                    <th className="px-5 py-3.5 w-36">Delivery Format</th>
                                    <th className="px-5 py-3.5 w-36">Schedule Type</th>
                                    <th className="px-5 py-3.5">Students Roster</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40">
                                {filteredRows.map((row, index) => {
                                    const serialNum = String(index + 1).padStart(2, '0');
                                    return (
                                        <tr 
                                            key={row.id} 
                                            className="hover:bg-slate-50/50 dark:hover:bg-slate-850/10 transition-colors group"
                                        >
                                            {/* Serial Number */}
                                            <td className="px-5 py-4 text-center font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">
                                                {serialNum}
                                            </td>

                                            {/* Class Details */}
                                            <td className="px-5 py-4 font-bold text-slate-900 dark:text-white text-sm">
                                                {row.classroom_id ? (
                                                    <Link 
                                                        href={`/teacher-dashboard/classrooms/${row.classroom_id}`}
                                                        className="hover:text-[#ecb613] transition-colors flex items-center gap-1.5"
                                                    >
                                                        <span>{row.name}</span>
                                                        <ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[#ecb613]" />
                                                    </Link>
                                                ) : (
                                                    <span>{row.name}</span>
                                                )}
                                            </td>

                                            {/* Class Timings */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold text-xs">
                                                    <Clock className="size-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                                    <span>
                                                        {formatTime12hr(row.start_time.slice(0, 5))} - {formatTime12hr(row.end_time.slice(0, 5))}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Delivery Format */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {row.isOnline ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30">
                                                        <Laptop className="size-3 shrink-0" /> Online
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30">
                                                        <Video className="size-3 shrink-0" /> Offline
                                                    </span>
                                                )}
                                            </td>

                                            {/* Schedule Type */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {row.isPermanent ? (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-800/30">
                                                        Permanent
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="inline-flex items-center w-fit px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30">
                                                            Temporary
                                                        </span>
                                                        {row.displayDate && (
                                                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold ml-1.5">
                                                                on {row.displayDate}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Students Roster */}
                                            <td className="px-5 py-4">
                                                {renderStudentsList(row.students)}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <Calendar className="size-10 text-slate-300 dark:text-slate-700" />
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-350">No classes scheduled</p>
                                                    <p className="text-xs text-slate-400 dark:text-slate-500">
                                                        There are no classes matching the current filters for {DAYS_OF_WEEK.find(d => d.value === selectedDay)?.label}.
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
