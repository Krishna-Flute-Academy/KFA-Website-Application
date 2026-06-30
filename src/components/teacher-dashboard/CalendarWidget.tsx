'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarEvent {
    id: string;
    type: 'recurring' | 'temporary';
    name: string;
    time: string;
    date: string;
    classroom_id: string | null;
}

interface CalendarDay {
    day: number;
    current: boolean;
    date: string;
    isToday: boolean;
    events: CalendarEvent[];
}

interface CalendarWidgetProps {
    calendarDate: Date;
    calendarMonth: string;
    calendarDays: CalendarDay[];
    setCalendarDate: (date: Date) => void;
    handleEventClick: (events: CalendarEvent[], dateStr: string) => void;
}

/**
 * CalendarWidget renders the monthly interactive grid calendar.
 * Recurring and makeup (temporary) classes are styled in blue and orange respectively.
 */
export default function CalendarWidget({
    calendarDate,
    calendarMonth,
    calendarDays,
    setCalendarDate,
    handleEventClick
}: CalendarWidgetProps) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-50/50 to-orange-50/10 dark:from-amber-950/10 dark:to-orange-950/5">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <h3 className="font-bold text-base sm:text-lg">Class Calendar</h3>
                    <div className="flex items-center gap-3 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1.5"><span className="size-2 sm:size-2.5 rounded-full bg-blue-500"></span> Recurring</span>
                        <span className="flex items-center gap-1.5"><span className="size-2 sm:size-2.5 rounded-full bg-orange-500"></span> Temporary</span>
                    </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                    <button 
                        onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} 
                        className="size-7 sm:size-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs sm:text-sm font-bold px-2">{calendarMonth}</span>
                    <button 
                        onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} 
                        className="size-7 sm:size-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
            
            <div className="p-3 sm:p-6">
                <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <div key={day} className="bg-slate-50 dark:bg-slate-900 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {day}
                        </div>
                    ))}
                    {calendarDays.map((cell, i) => (
                        <div
                            key={i}
                            onClick={() => {
                                if (cell.current) {
                                    handleEventClick(cell.events, cell.date);
                                }
                            }}
                            className={`bg-white dark:bg-slate-900 h-14 sm:h-24 p-1 sm:p-2 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                                cell.current ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-300 dark:text-slate-650'
                            } ${cell.isToday ? 'ring-2 ring-[#ecb613] ring-inset bg-[#ecb613]/5' : ''}`}
                        >
                            <span className={`text-[10px] sm:text-xs ${cell.isToday ? 'text-[#ecb613] font-bold' : ''}`}>{cell.day}</span>
                            <div className="mt-0.5 sm:mt-1 overflow-hidden">
                                {/* Desktop events list */}
                                <div className="hidden sm:block space-y-1">
                                    {cell.events.slice(0, 2).map((evt, j) => (
                                        <div
                                            key={j}
                                            className={`w-full text-left text-[9px] font-bold px-1.5 py-0.5 rounded truncate ${
                                                evt.type === 'recurring'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                            }`}
                                        >
                                            {evt.name}
                                        </div>
                                    ))}
                                    {cell.events.length > 2 && (
                                        <span className="text-[9px] text-slate-400 font-bold">+{cell.events.length - 2} more</span>
                                    )}
                                </div>
                                {/* Mobile event indicator dots */}
                                <div className="flex sm:hidden flex-wrap gap-0.5 justify-center mt-0.5">
                                    {cell.events.slice(0, 3).map((evt, j) => (
                                        <span
                                            key={j}
                                            className={`size-1 rounded-full ${
                                                evt.type === 'recurring' ? 'bg-blue-500' : 'bg-orange-500'
                                            }`}
                                        />
                                    ))}
                                    {cell.events.length > 3 && (
                                        <span className="text-[7px] text-slate-400 font-bold leading-none">+</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
