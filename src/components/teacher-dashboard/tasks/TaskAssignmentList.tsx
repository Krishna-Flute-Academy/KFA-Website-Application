'use client';

import React, { useState, useMemo } from 'react';
import { 
    Clock, Users, Edit2, Trash2, CheckCircle, BookOpen, Paperclip, 
    ChevronRight, ExternalLink, Calendar, Plus, Search, Filter 
} from 'lucide-react';
import { AssignmentBatch, TaskSubmission, Classroom, formatDateForInput } from './types';
import TaskStudentsModal from './TaskStudentsModal';
import AutoLinkText from '../../../components/common/AutoLinkText';

interface TaskAssignmentListProps {
    batches: AssignmentBatch[];
    classrooms: Classroom[];
    onEditAssignment: (assignmentId: string) => void;
    onDeleteAssignment: (assignmentId: string) => void;
    onQuickUpdateDueDate: (taskId: string, newDueDate: string) => Promise<void>;
    onReviewSubmission: (sub: TaskSubmission) => void;
    searchQuery: string;
}

export default function TaskAssignmentList({
    batches,
    classrooms,
    onEditAssignment,
    onDeleteAssignment,
    onQuickUpdateDueDate,
    onReviewSubmission,
    searchQuery
}: TaskAssignmentListProps) {
    const [selectedFilterClassroomId, setSelectedFilterClassroomId] = useState<string>('all');
    const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'active' | 'completed' | 'draft'>('all');
    const [inspectingBatch, setInspectingBatch] = useState<AssignmentBatch | null>(null);

    const activeAssignmentClassrooms = useMemo(() => {
        const classMap = new Map<string, { id: string; name: string; count: number }>();
        
        batches.forEach(b => {
            const id = b.classroomId || 'individual';
            const name = b.classroomName || 'Individual / Cross-Class';
            const current = classMap.get(id);
            if (current) {
                current.count += 1;
            } else {
                classMap.set(id, { id, name, count: 1 });
            }
        });

        return Array.from(classMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [batches]);

    // Group batches by task title (so multiple classrooms assigned the same task are presented cleanly together)
    const filteredBatches = useMemo(() => {
        let list = batches;

        if (selectedFilterClassroomId !== 'all') {
            list = list.filter(b => (b.classroomId || 'individual') === selectedFilterClassroomId);
        }

        if (activeStatusFilter === 'draft') {
            list = list.filter(b => b.isDraft);
        } else if (activeStatusFilter === 'completed') {
            list = list.filter(b => !b.isDraft && b.totalCount > 0 && (b.approvedCount + b.reviewedCount) === b.totalCount);
        } else if (activeStatusFilter === 'active') {
            list = list.filter(b => !b.isDraft && ((b.approvedCount + b.reviewedCount) < b.totalCount || b.totalCount === 0));
        }

        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase().trim();
            list = list.filter(b => 
                b.taskTitle.toLowerCase().includes(query) ||
                (b.classroomName && b.classroomName.toLowerCase().includes(query)) ||
                (b.inventoryRefTitle && b.inventoryRefTitle.toLowerCase().includes(query))
            );
        }

        // Sort latest first
        return [...list].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }, [batches, selectedFilterClassroomId, activeStatusFilter, searchQuery]);

    return (
        <div className="space-y-4">
            {/* Filter Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setActiveStatusFilter('all')}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            activeStatusFilter === 'all'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        All ({batches.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveStatusFilter('active')}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            activeStatusFilter === 'active'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        Active ({batches.filter(b => !b.isDraft && ((b.approvedCount + b.reviewedCount) < b.totalCount || b.totalCount === 0)).length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveStatusFilter('completed')}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            activeStatusFilter === 'completed'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        Completed ({batches.filter(b => !b.isDraft && b.totalCount > 0 && (b.approvedCount + b.reviewedCount) === b.totalCount).length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveStatusFilter('draft')}
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            activeStatusFilter === 'draft'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        Drafts ({batches.filter(b => b.isDraft).length})
                    </button>
                </div>

                {/* Classroom Filter */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 hidden sm:inline">Classroom:</span>
                    <select
                        value={selectedFilterClassroomId}
                        onChange={(e) => setSelectedFilterClassroomId(e.target.value)}
                        className="min-h-[38px] px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#ecb613]"
                    >
                        <option value="all">All Classrooms ({batches.length})</option>
                        {activeAssignmentClassrooms.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.count})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Assignments Grid / Cards */}
            {filteredBatches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredBatches.map(batch => {
                        const totalStudents = batch.totalCount;
                        const reviewedOrApproved = batch.reviewedCount + batch.approvedCount;
                        const percentComplete = totalStudents > 0 ? Math.round((reviewedOrApproved / totalStudents) * 100) : 0;
                        const isOverdue = batch.dueDate && new Date(batch.dueDate) < new Date() && !batch.isDraft && percentComplete < 100;

                        return (
                            <div 
                                key={batch.assignmentId}
                                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition-all space-y-4"
                            >
                                {/* Card Top: Title, Target & Menu Actions */}
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 truncate">
                                                    🏫 {batch.classroomName}
                                                </span>
                                                {batch.isDraft ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                        Draft
                                                    </span>
                                                ) : isOverdue ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                                                        Past Due
                                                    </span>
                                                ) : null}
                                            </div>
                                            <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-snug truncate">
                                                {batch.taskTitle}
                                            </h3>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => onEditAssignment(batch.assignmentId)}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-[#ecb613] rounded-xl transition-colors"
                                                title="Edit Assignment"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onDeleteAssignment(batch.assignmentId)}
                                                className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                                                title="Delete Assignment"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Task description summary */}
                                    {batch.taskDescription && (
                                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                            {batch.taskDescription}
                                        </p>
                                    )}

                                    {/* Topic Reference & Material badges */}
                                    {(batch.inventoryRefTitle || batch.fileName) && (
                                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                                            {batch.inventoryRefTitle && (
                                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 truncate max-w-[200px] flex items-center gap-1">
                                                    <BookOpen className="w-3 h-3" />
                                                    {batch.inventoryRefTitle}
                                                </span>
                                            )}
                                            {batch.fileName && (
                                                <span className="text-[11px] text-slate-500 truncate max-w-[180px] flex items-center gap-1">
                                                    <Paperclip className="w-3 h-3 text-amber-600" />
                                                    {batch.fileName}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Progress Metrics & Date */}
                                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    {/* Dates & Due date changer */}
                                    <div className="flex items-center justify-between gap-2 text-xs">
                                        <span className="text-slate-400 text-[11px]">
                                            Assigned: {batch.createdAt ? new Date(batch.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                                        </span>

                                        <div className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                            <input 
                                                type="date"
                                                value={formatDateForInput(batch.dueDate)}
                                                onChange={(e) => onQuickUpdateDueDate(batch.assignmentId, e.target.value)}
                                                className="bg-transparent text-slate-800 dark:text-slate-200 font-mono text-xs font-bold outline-none cursor-pointer"
                                                title="Quick change due date"
                                            />
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    {!batch.isDraft && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-[11px] font-bold">
                                                <span className="text-slate-600 dark:text-slate-400">
                                                    {totalStudents} Assigned • {batch.submittedCount} Awaiting Review
                                                </span>
                                                <span className="text-[#ecb613] font-mono font-black">
                                                    {percentComplete}% Reviewed
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                                <div 
                                                    style={{ width: `${percentComplete}%` }} 
                                                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                                />
                                                {batch.submittedCount > 0 && totalStudents > 0 && (
                                                    <div 
                                                        style={{ width: `${(batch.submittedCount / totalStudents) * 100}%` }} 
                                                        className="bg-[#ecb613] h-full" 
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Footer Button: View Students */}
                                    <div className="flex items-center justify-between gap-2 pt-1">
                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                            {batch.approvedCount} approved, {batch.reviewedCount} needs revision
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => setInspectingBatch(batch)}
                                            className="min-h-[38px] px-3.5 py-1.5 bg-slate-100 hover:bg-[#ecb613] text-slate-800 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-[#ecb613] dark:hover:text-slate-900 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
                                        >
                                            <Users className="w-3.5 h-3.5" />
                                            <span>View Students ({totalStudents})</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-12 text-center text-slate-500">
                    No task assignments found for the selected filters.
                </div>
            )}

            {/* Students Modal */}
            {inspectingBatch && (
                <TaskStudentsModal 
                    batch={inspectingBatch}
                    onClose={() => setInspectingBatch(null)}
                    onReviewSubmission={onReviewSubmission}
                />
            )}
        </div>
    );
}
