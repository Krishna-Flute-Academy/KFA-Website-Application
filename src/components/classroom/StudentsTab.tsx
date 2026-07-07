'use client';

import React from 'react';
import Link from 'next/link';
import { 
    Calendar, UserPlus, Trash2, Loader2, Plus, 
    AlertTriangle, Sparkles, BarChart2
} from 'lucide-react';

interface Student {
    id: string;
    student_id: string;
    name: string;
    level?: string;
    profile_pic_url?: string | null;
    mock_progress: number;
    mock_status: string;
    mock_score: number;
    mock_attendance: number;
    joined_at: string;
    mock_milestone?: string;
    is_makeup?: boolean;
}

interface StudentsTabProps {
    students: Student[];
    classroom: any;
    openMakeupModal: () => void;
    openDirectoryModal: () => void;
    paginatedStudents: Student[];
    getRealStudentProgress: (studentId: string, mockVal: number) => number;
    handleRemoveStudent: (student: Student) => void;
    removingStudentId: string | null;
    currentPage: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    PAGE_SIZE: number;
    totalPages: number;
    sessionOverrides: any[];
    formatLocalDate: (dateStr: string) => Date;
    openRescheduleModal: (override: any) => void;
    handleDeleteOverride: (id: string) => Promise<void>;
    isDeletingOverrideId: string | null;
    avgAttendance: number;
}

function getStatusColor(status: string) {
    if (status === 'Consistent') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
    if (status === 'Improving') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400';
}

function getGrade(score: number) {
    if (score >= 9) return 'A';
    if (score >= 8) return 'B';
    if (score >= 7) return 'C';
    return 'D';
}

export default function StudentsTab({
    students,
    classroom,
    openMakeupModal,
    openDirectoryModal,
    paginatedStudents,
    getRealStudentProgress,
    handleRemoveStudent,
    removingStudentId,
    currentPage,
    setCurrentPage,
    PAGE_SIZE,
    totalPages,
    sessionOverrides,
    formatLocalDate,
    openRescheduleModal,
    handleDeleteOverride,
    isDeletingOverrideId,
    avgAttendance
}: StudentsTabProps) {
    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
            {/* Actions Header */}
            <div className="flex justify-between items-end flex-wrap gap-4">
                <div>
                    <h3 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Student Roster</h3>
                    <p className="text-slate-505 dark:text-slate-400 mt-1">Managing {students.length} students in {classroom.name}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={openMakeupModal}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-all shadow-md shadow-emerald-600/20"
                    >
                        <Calendar className="w-5 h-5" />
                        Schedule Makeup
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
                                <th className="px-6 py-4 text-xs font-black text-slate-505 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-505 dark:text-slate-400 uppercase tracking-wider">Progress</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-505 dark:text-slate-400 uppercase tracking-wider">Attendance</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider">Grade</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {paginatedStudents.map(student => (
                                <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-600 flex items-center justify-center shrink-0">
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
                                        {(() => {
                                            const realProgress = getRealStudentProgress(student.student_id, student.mock_progress);
                                            return (
                                                <div className="w-32">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550">{realProgress}% Complete</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 flex overflow-hidden">
                                                        <div className={`h-1.5 rounded-full ${student.mock_status === 'At Risk' ? 'bg-rose-500' : 'bg-[#ecb613]'}`} style={{ width: `${realProgress}%` }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">{student.mock_attendance}%</td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{getGrade(student.mock_score)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleRemoveStudent(student)}
                                            disabled={removingStudentId === student.id}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all disabled:opacity-50 text-left"
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
                    <p className="text-xs font-bold text-slate-550 dark:text-slate-400">
                        Showing {paginatedStudents.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} - {Math.min(currentPage * PAGE_SIZE, students.length)} of {students.length} students
                    </p>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 bg-white dark:bg-slate-80 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-655 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 shadow-sm"
                        >
                            Previous
                        </button>
                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1 bg-white dark:bg-slate-80 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-655 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 shadow-sm"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Temporary Session overrides (Makeup Classes) Section */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-6">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-emerald-600" />
                            Temporary Session Allocations / Makeups
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">Students assigned to this classroom for a single class date (e.g. makeup sessions).</p>
                    </div>
                    <button
                        onClick={openMakeupModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-955/20 dark:text-emerald-400 dark:hover:bg-emerald-955/40 font-bold text-xs transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Makeup
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider">Student</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider">Class Date</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider">Reason / Notes</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 tracking-wider"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {sessionOverrides.map(override => (
                                <tr key={override.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-600 flex items-center justify-center shrink-0">
                                                {override.users?.profile_pic_url ? (
                                                    <img alt={override.users?.name} className="w-full h-full object-cover" src={override.users?.profile_pic_url} loading="lazy" />
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{override.users?.name?.charAt(0) || 'U'}</span>
                                                )}
                                            </div>
                                            <div>
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{override.users?.name || 'Unknown'}</span>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">{override.users?.level || 'Beginner'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                            {formatLocalDate(override.override_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400 italic">
                                        {override.reason || 'No details provided'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            <button
                                                onClick={() => openRescheduleModal(override)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-605 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-955/40 rounded-lg transition-all"
                                                title="Reschedule makeup allocation"
                                            >
                                                <Calendar className="w-3.5 h-3.5" />
                                                Reschedule
                                            </button>
                                            <button
                                                onClick={() => handleDeleteOverride(override.id)}
                                                disabled={isDeletingOverrideId === override.id}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-all disabled:opacity-50 text-left"
                                                title="Cancel temporary allocation"
                                            >
                                                {isDeletingOverrideId === override.id
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <Trash2 className="w-3.5 h-3.5" />}
                                                Cancel
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {sessionOverrides.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center bg-slate-50 dark:bg-slate-800/30">
                                        <p className="text-slate-500 dark:text-slate-400 text-xs italic">No temporary overrides or makeup bookings scheduled for this class.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Focus Tasks / Assistant View */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:grid-cols-3">
                <div className="bg-rose-50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/50 p-6 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3 mb-4 text-rose-800 dark:text-rose-400">
                        <AlertTriangle className="w-5 h-5" />
                        <h4 className="font-bold">Urgent Attention Needed</h4>
                    </div>
                    <p className="text-sm text-rose-700 dark:text-rose-300 mb-4">Julian Chen has missed 3 consecutive classes and hasn't submitted the 'Bach Invention No. 4' assignment.</p>
                    <button className="w-full py-2 bg-rose-600 dark:bg-rose-700 text-white rounded-lg font-bold text-sm hover:bg-rose-700 dark:hover:bg-rose-600 transition-colors">
                        Message Guardian
                    </button>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/50 p-6 rounded-xl shadow-sm">
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
                    <div className="pt-4 border-t border-slate-900/20 mt-4 text-left">
                        <p className="text-xs font-semibold italic text-slate-900/80">"Strongest participation on Wednesdays."</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
