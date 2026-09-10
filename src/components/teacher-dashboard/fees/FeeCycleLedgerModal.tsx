'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
    FeeCycleLedgerReport,
    FeeCycleSessionItem,
    FeeCycleDiagnostic
} from '../../../lib/fee-utils';
import {
    Calendar,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Clock,
    ArrowRight,
    X,
    ExternalLink,
    HelpCircle,
    Info,
    CalendarCheck,
    RotateCcw,
    Sparkles
} from 'lucide-react';
import { ArrangeMakeupModal } from '../../makeup/ArrangeMakeupModal';

interface FeeCycleLedgerModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: FeeCycleLedgerReport | null;
    studentName: string;
    studentBatch?: string;
    studentAvatar?: string | null;
    studentId: string;
    loading?: boolean;
    onRefresh?: () => void;
}

export default function FeeCycleLedgerModal({
    isOpen,
    onClose,
    report,
    studentName,
    studentBatch,
    studentAvatar,
    studentId,
    loading = false,
    onRefresh
}: FeeCycleLedgerModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const [showArrangeMakeup, setShowArrangeMakeup] = useState(false);
    const [makeupMissedSession, setMakeupMissedSession] = useState<{ date: string; classroomId?: string; classroomName?: string }>({ date: '' });

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Prevent body scroll while modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const summary = report?.summary;
    const hasDiscrepancy = summary?.hasDiscrepancy ?? false;
    const unresolvedCount = summary?.unresolvedSessions ?? 0;

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={(e) => {
                if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                    onClose();
                }
            }}
            role="dialog"
            aria-modal="true"
            aria-label={`Fee Cycle Ledger for ${studentName}`}
        >
            <div
                ref={modalRef}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-full bg-[#ecb613]/10 text-[#ecb613] font-bold flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                            {studentAvatar ? (
                                <img src={studentAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span>{studentName.charAt(0)}</span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                    {studentName}
                                </h3>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                                    {report?.feesBasis === 'monthly' ? 'Monthly' : 'Class Basis'}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                <span>{studentBatch || 'Regular Batch'}</span>
                                {report?.cycleStart && report?.nextDueDate && (
                                    <>
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                            <Calendar className="size-3 text-slate-400" />
                                            {report.cycleStart} → {report.nextDueDate}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-2"
                        aria-label="Close modal"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-left">
                    {loading ? (
                        <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                            <div className="size-7 border-2 border-[#ecb613] border-t-transparent rounded-full animate-spin mb-3"></div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Evaluating Cycle Ledger...</p>
                        </div>
                    ) : !report ? (
                        <div className="py-12 text-center text-slate-400">
                            <HelpCircle className="size-8 mx-auto mb-2 text-slate-300" />
                            <p className="text-sm font-semibold">No fee cycle data available for this student.</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary Numbers Grid: User Adjustment #2 (Explicit 6 metrics) */}
                            {report.feesBasis === 'monthly' && summary && (
                                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850/70 border border-slate-200/80 dark:border-slate-800/80">
                                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                            Cycle Class Accounting
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            report.metrics.badgeVariant === 'warning'
                                                ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                                                : report.metrics.badgeVariant === 'good'
                                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}>
                                            {report.metrics.statusLabel}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                                        <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                            <p className="text-[9px] font-bold uppercase text-slate-400">Entitled</p>
                                            <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">
                                                {summary.entitledClasses}
                                            </p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                            <p className="text-[9px] font-bold uppercase text-slate-400">Consumed</p>
                                            <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">
                                                {summary.consumedClasses}
                                            </p>
                                        </div>
                                        <div className={`p-2 rounded-lg border ${
                                            hasDiscrepancy
                                                ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                                        }`}>
                                            <p className="text-[9px] font-bold uppercase text-slate-400" title="Unused financial credits paid in this cycle">
                                                Unused Credits
                                            </p>
                                            <p className={`text-sm font-black mt-0.5 ${hasDiscrepancy ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                                {summary.creditsRemaining}
                                            </p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                            <p className="text-[9px] font-bold uppercase text-slate-400" title="Future classes or scheduled makeups">
                                                Opportunities
                                            </p>
                                            <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">
                                                {summary.operationalOpportunities}
                                            </p>
                                        </div>
                                        <div className={`p-2 rounded-lg border ${
                                            unresolvedCount > 0
                                                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                                        }`}>
                                            <p className="text-[9px] font-bold uppercase text-slate-400" title="Past scheduled sessions without attendance">
                                                Unresolved
                                            </p>
                                            <p className={`text-sm font-black mt-0.5 ${unresolvedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                                {unresolvedCount}
                                            </p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-[#ecb613]/10 border border-[#ecb613]/30">
                                            <p className="text-[9px] font-bold uppercase text-slate-400" title="Operational classes available for booking/attendance">
                                                Available
                                            </p>
                                            <p className="text-sm font-black text-[#b45309] dark:text-[#ecb613] mt-0.5">
                                                {summary.classesAvailable}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Per-Class Summary Card */}
                            {report.feesBasis === 'class' && (
                                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850/70 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Per-Class Prepaid Standing</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">Credits deduct upon attendance marking (present, late, absent).</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xl font-black text-[#b45309] dark:text-[#ecb613]">
                                            {report.metrics.classesAvailable}
                                        </span>
                                        <span className="text-xs text-slate-400 ml-1 font-medium">prepaid credits</span>
                                    </div>
                                </div>
                            )}

                            {/* Diagnostics Card (if issues detected) */}
                            {report.diagnostics.length > 0 && (
                                <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2.5">
                                    <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 text-xs font-bold">
                                        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                        <span>Diagnostics & Required Actions ({report.diagnostics.length})</span>
                                    </div>
                                    <div className="space-y-2">
                                        {report.diagnostics.map((diag, idx) => (
                                            <div key={idx} className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-amber-200/80 dark:border-amber-800/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                                        <span className="size-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                                        {diag.title}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                                        {diag.detail}
                                                    </p>
                                                </div>
                                                {diag.actionUrl && (
                                                    <Link
                                                        href={diag.actionUrl}
                                                        onClick={onClose}
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200/70 dark:hover:bg-amber-900/50 transition-colors shrink-0 cursor-pointer self-start sm:self-center"
                                                    >
                                                        {diag.actionLabel || 'Review Record →'}
                                                    </Link>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Chronological Session Ledger */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                        <CalendarCheck className="size-3.5" />
                                        Cycle Session Ledger ({report.sessions.length})
                                    </h4>
                                    <span className="text-[11px] text-slate-400">
                                        Half-open interval [start, due)
                                    </span>
                                </div>

                                {report.sessions.length === 0 ? (
                                    <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                                        No scheduled session occurrences detected inside this cycle interval.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden">
                                        {report.sessions.map((sess) => {
                                            const isUnresolved = sess.status === 'unresolved' || sess.status === 'makeup_unresolved';
                                            const isAttended = sess.status === 'attended' || sess.status === 'makeup_attended';
                                            const isAbsent = sess.status === 'absent';
                                            const isExcused = sess.status === 'excused';
                                            const isCancelled = sess.status === 'cancelled';

                                            return (
                                                <div
                                                    key={sess.id}
                                                    className={`p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
                                                        isUnresolved
                                                            ? 'bg-amber-50/50 dark:bg-amber-950/10'
                                                            : 'bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-850/50'
                                                    }`}
                                                >
                                                    {/* Left: Date, Day, Batch */}
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-16 shrink-0 text-left">
                                                            <p className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                                                {sess.displayDate.split(' ').slice(0, 2).join(' ')}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                                                                {sess.dayName}
                                                            </p>
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                                                    {sess.classroomName}
                                                                </span>
                                                                {sess.sessionType !== 'regular' && (
                                                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                                                                        {sess.sessionType}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {sess.notes && (
                                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                                                    {sess.notes}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Right: Status badge, impact, action */}
                                                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pl-19 sm:pl-0">
                                                        {/* Status Label */}
                                                        <div className="text-right">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                isAttended
                                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                                                    : isAbsent
                                                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                                                    : isExcused
                                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                                                    : isCancelled
                                                                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                                                    : isUnresolved
                                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-extrabold'
                                                                    : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                                            }`}>
                                                                {sess.statusLabel}
                                                            </span>
                                                            <span className="block text-[9px] text-slate-400 mt-0.5">
                                                                {sess.creditImpactLabel}
                                                            </span>
                                                        </div>

                                                        {/* Direct action link or Arrange Makeup */}
                                                        {sess.status === 'makeup_pending' ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setMakeupMissedSession({
                                                                        date: sess.date,
                                                                        classroomId: sess.classroomId,
                                                                        classroomName: sess.classroomName
                                                                    });
                                                                    setShowArrangeMakeup(true);
                                                                }}
                                                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer bg-[#ecb613] hover:bg-[#ecb613]/90 text-slate-900 shadow-xs shrink-0"
                                                                title="Arrange makeup for this excused date"
                                                            >
                                                                <Sparkles className="size-3" />
                                                                <span className="text-[10px] font-black">Arrange Makeup</span>
                                                            </button>
                                                        ) : sess.actionUrl ? (
                                                            <Link
                                                                href={sess.actionUrl}
                                                                onClick={onClose}
                                                                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                                                    isUnresolved
                                                                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                                                                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                                                                }`}
                                                                title={sess.actionLabel || 'Go to attendance'}
                                                            >
                                                                <span className="text-[10px] hidden md:inline">
                                                                    {isUnresolved ? 'Review' : 'View'}
                                                                </span>
                                                                <ArrowRight className="size-3.5" />
                                                            </Link>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
                    <div className="flex items-center gap-3">
                        <Link
                            href={`/teacher-dashboard/attendance`}
                            onClick={onClose}
                            className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium flex items-center gap-1 hover:underline cursor-pointer"
                        >
                            Open Attendance Module
                            <ExternalLink className="size-3" />
                        </Link>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <Link
                            href={`/teacher-dashboard/students/${studentId}?tab=attendance`}
                            onClick={onClose}
                            className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium flex items-center gap-1 hover:underline cursor-pointer"
                        >
                            Student Profile Log
                            <ExternalLink className="size-3" />
                        </Link>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-colors cursor-pointer text-xs ml-auto"
                    >
                        Close
                    </button>
                </div>

                {/* Arrange Makeup Modal nested trigger */}
                {showArrangeMakeup && (
                    <ArrangeMakeupModal
                        isOpen={showArrangeMakeup}
                        onClose={() => setShowArrangeMakeup(false)}
                        onSuccess={() => {
                            setShowArrangeMakeup(false);
                            onRefresh?.();
                        }}
                        student={{
                            id: studentId,
                            name: studentName,
                            profile_pic_url: studentAvatar
                        }}
                        missedSession={makeupMissedSession}
                    />
                )}
            </div>
        </div>,
        document.body
    );
}
