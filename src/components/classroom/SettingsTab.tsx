'use client';

import React from 'react';
import { 
    Clock, Calendar, Trash2, PlusCircle, Edit3, 
    AlertTriangle, CheckCircle, Loader2 
} from 'lucide-react';

interface SettingsTabProps {
    schedules: any[];
    DAY_NAMES: string[];
    formatTime12hr: (timeStr: string) => string;
    handleDeleteSchedule: (id: string) => Promise<void>;
    newSchedule: {
        day: number;
        start: string;
        end: string;
    };
    setNewSchedule: React.Dispatch<React.SetStateAction<any>>;
    TIME_OPTIONS: { value: string; label: string }[];
    handleSaveSchedule: () => void;
    isSavingSchedule: boolean;
    metadataForm: {
        name: string;
        description: string;
        status: string;
        delivery_format?: 'online' | 'offline';
        class_date?: string;
        start_time?: string;
        end_time?: string;
    };
    setMetadataForm: React.Dispatch<React.SetStateAction<any>>;
    metadataError: string;
    metadataSaved: boolean;
    classroom: any;
    handleSaveMetadata: () => void;
    isSavingMetadata: boolean;
}

function addOneHour(timeStr: string): string {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return '';
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return '';
    const newHour = (h + 1) % 24;
    return `${String(newHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function SettingsTab({
    schedules,
    DAY_NAMES,
    formatTime12hr,
    handleDeleteSchedule,
    newSchedule,
    setNewSchedule,
    TIME_OPTIONS,
    handleSaveSchedule,
    isSavingSchedule,
    metadataForm,
    setMetadataForm,
    metadataError,
    metadataSaved,
    classroom,
    handleSaveMetadata,
    isSavingMetadata
}: SettingsTabProps) {
    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-8 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Classroom Settings</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        {classroom?.type === 'temporary' ? 'Manage class details and timings.' : 'Manage class details and recurring schedule timings.'}
                    </p>
                </div>
                <div className="p-8 space-y-10">
                    {/* Schedule Section */}
                    {classroom?.type !== 'temporary' && (
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
                                                    <div className="text-left">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{DAY_NAMES[slot.day_of_week]}</p>
                                                        <p className="text-xs font-medium text-slate-550">{formatTime12hr(slot.start_time)} - {formatTime12hr(slot.end_time)}</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleDeleteSchedule(slot.id)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
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
                                            onChange={(e) => setNewSchedule((prev: any) => ({ ...prev, day: parseInt(e.target.value) }))}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#ecb613] outline-none transition-all text-slate-800 dark:text-slate-100"
                                        >
                                            {DAY_NAMES.map((day, idx) => (
                                                <option key={idx} value={idx}>{day}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-505 mb-2 px-1 uppercase tracking-wide">Start Time</label>
                                            <input 
                                                type="time"
                                                value={newSchedule.start}
                                                onChange={(e) => {
                                                    const newStart = e.target.value;
                                                    setNewSchedule((prev: any) => ({
                                                        ...prev,
                                                        start: newStart,
                                                        end: addOneHour(newStart)
                                                    }));
                                                }}
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#ecb613] outline-none transition-all text-slate-800 dark:text-slate-100"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-550 mb-2 px-1 uppercase tracking-wide">End Time</label>
                                            <input 
                                                type="time"
                                                value={newSchedule.end}
                                                onChange={(e) => setNewSchedule((prev: any) => ({ ...prev, end: e.target.value }))}
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#ecb613] outline-none transition-all text-slate-800 dark:text-slate-100"
                                            />
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleSaveSchedule}
                                        disabled={isSavingSchedule}
                                        className="w-full bg-[#ecb613] text-slate-900 font-bold py-3 rounded-xl shadow-md shadow-[#ecb613]/20 hover:bg-[#ecb613]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2 cursor-pointer"
                                    >
                                        {isSavingSchedule ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
                                        Save Schedule Slot
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                    {classroom?.type !== 'temporary' && <hr className="border-slate-100 dark:border-slate-800" />}

                    {/* Class Details – Editable */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <Edit3 className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Class Details</h4>
                                <p className="text-xs text-slate-500">Edit class name, description, and status.</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {/* Class Name */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider px-1">
                                    Class Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={metadataForm.name}
                                    onChange={e => setMetadataForm((prev: any) => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. Morning Beginners Batch"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider px-1">Description</label>
                                <textarea
                                    rows={4}
                                    value={metadataForm.description}
                                    onChange={e => setMetadataForm((prev: any) => ({ ...prev, description: e.target.value }))}
                                    placeholder="Briefly describe the focus, level, or goals of this class…"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all resize-none placeholder:text-slate-455 font-semibold"
                                />
                            </div>

                            {classroom?.type === 'temporary' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1.5 text-left">
                                        <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider px-1">
                                            Class Date <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={metadataForm.class_date}
                                            onChange={e => setMetadataForm((prev: any) => ({ ...prev, class_date: e.target.value }))}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5 text-left">
                                        <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider px-1">
                                            Start Time <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={metadataForm.start_time}
                                            onChange={e => {
                                                const newStart = e.target.value;
                                                setMetadataForm((prev: any) => ({
                                                    ...prev,
                                                    start_time: newStart,
                                                    end_time: addOneHour(newStart)
                                                }));
                                            }}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5 text-left">
                                        <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider px-1">
                                            End Time <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={metadataForm.end_time}
                                            onChange={e => setMetadataForm((prev: any) => ({ ...prev, end_time: e.target.value }))}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#ecb613]/30 focus:border-[#ecb613] outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Delivery Format */}
                            <div className="space-y-1.5 text-left">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">Delivery Format</label>
                                <div className="flex items-center gap-3">
                                    {(['online', 'offline'] as const).map(df => (
                                        <button
                                            key={df}
                                            type="button"
                                            onClick={() => setMetadataForm((prev: any) => ({ ...prev, delivery_format: df }))}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                                                metadataForm.delivery_format === df
                                                    ? df === 'online'
                                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                                        : 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                                    : 'border-slate-200 dark:border-slate-700 text-slate-450 dark:text-slate-500 hover:border-slate-350 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                df === 'online' ? 'bg-blue-500' : 'bg-emerald-500'
                                            }`} />
                                            {df}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Status */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider px-1">Class Status</label>
                                <div className="flex items-center gap-3">
                                    {(['active', 'inactive', 'archived'] as const).map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setMetadataForm((prev: any) => ({ ...prev, status: s }))}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                                                metadataForm.status === s
                                                    ? s === 'active'
                                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-450'
                                                        : s === 'inactive'
                                                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-450'
                                                        : 'border-slate-400 bg-slate-100 dark:bg-slate-805 text-slate-600 dark:text-slate-400'
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
                                    <CheckCircle className="w-4 h-4 text-emerald-505 flex-shrink-0" />
                                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-405">Changes saved successfully!</p>
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
                                        class_date: classroom?.class_date || '',
                                        start_time: classroom?.start_time ? classroom.start_time.slice(0, 5) : '10:00',
                                        end_time: classroom?.end_time ? classroom.end_time.slice(0, 5) : '11:00',
                                    })}
                                    className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                                >
                                    Reset changes
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveMetadata}
                                    disabled={isSavingMetadata}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 font-bold text-sm rounded-xl shadow-md shadow-[#ecb613]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
    );
}
