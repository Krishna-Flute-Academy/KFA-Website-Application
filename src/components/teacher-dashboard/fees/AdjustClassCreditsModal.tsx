'use client';

import React, { useState } from 'react';
import { supabaseAuth } from '../../../lib/supabase-auth';
import { PlusCircle, MinusCircle, AlertCircle, CheckCircle2, Loader2, X, Sparkles } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    studentId: string;
    studentName: string;
    currentBalance: number;
    onSuccess?: () => void;
}

export default function AdjustClassCreditsModal({
    isOpen,
    onClose,
    studentId,
    studentName,
    currentBalance,
    onSuccess
}: Props) {
    const [type, setType] = useState<'credit' | 'debit'>('credit');
    const [classesCount, setClassesCount] = useState<number>(1);
    const [reason, setReason] = useState<string>('Reconciliation adjustment');
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    if (!isOpen) return null;

    const delta = type === 'credit' ? classesCount : -classesCount;
    const newBalance = Math.max(0, currentBalance + delta);

    const quickReasons = [
        'Reconciliation adjustment',
        'Compensatory bonus class',
        'Attendance correction',
        'Administrative manual credit'
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);
        setLoading(true);

        try {
            const { data: { session } } = await supabaseAuth.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('Not authenticated. Please log in again.');

            const res = await fetch('/api/admin/fees/adjust-balance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    studentId,
                    type,
                    classesCount,
                    reason
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to adjust balance');
            }

            setSuccessMsg(data.message || 'Balance successfully updated!');
            if (onSuccess) {
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 900);
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/40">
                    <div className="flex items-center gap-2">
                        <div className="size-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-sm">
                            ±
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Manual Class Balance Adjustment
                            </h3>
                            <p className="text-xs text-slate-400">
                                Student: <span className="font-semibold text-slate-700 dark:text-slate-300">{studentName}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Error / Success Alerts */}
                    {errorMsg && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
                            <AlertCircle className="size-4 shrink-0 text-rose-600" />
                            <span>{errorMsg}</span>
                        </div>
                    )}
                    {successMsg && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                            <span>{successMsg}</span>
                        </div>
                    )}

                    {/* Current Balance & Adjustment Type */}
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">
                            Adjustment Type
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setType('credit')}
                                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                    type === 'credit'
                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-500 dark:text-emerald-300 shadow-sm'
                                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                                }`}
                            >
                                <PlusCircle className="size-4 text-emerald-600" />
                                <span>+ Credit (Add)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('debit')}
                                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                    type === 'debit'
                                        ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-950/40 dark:border-rose-500 dark:text-rose-300 shadow-sm'
                                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                                }`}
                            >
                                <MinusCircle className="size-4 text-rose-600" />
                                <span>- Debit (Deduct)</span>
                            </button>
                        </div>
                    </div>

                    {/* Classes Count */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Number of Classes
                        </label>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setClassesCount(Math.max(1, classesCount - 1))}
                                className="size-9 rounded-xl border border-slate-200 dark:border-slate-700 font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-sm"
                            >
                                -
                            </button>
                            <input
                                type="number"
                                min={1}
                                max={20}
                                value={classesCount}
                                onChange={e => setClassesCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="flex-1 text-center bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl py-2 text-sm font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/30"
                            />
                            <button
                                type="button"
                                onClick={() => setClassesCount(classesCount + 1)}
                                className="size-9 rounded-xl border border-slate-200 dark:border-slate-700 font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-sm"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {/* Balance Preview Card */}
                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-xl flex items-center justify-between text-xs">
                        <div>
                            <span className="text-slate-500 dark:text-slate-400">Current Balance: </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{currentBalance} classes</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-black text-amber-900 dark:text-amber-300">
                            <Sparkles className="size-3.5 text-amber-500" />
                            <span>New Balance: {newBalance} classes</span>
                        </div>
                    </div>

                    {/* Reason / Notes */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Reason / Adjustment Memo
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {quickReasons.map((qr) => (
                                <button
                                    key={qr}
                                    type="button"
                                    onClick={() => setReason(qr)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                                        reason === qr
                                            ? 'bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                                    }`}
                                >
                                    {qr}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            required
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Enter specific reason for this adjustment..."
                            className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/30"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !!successMsg}
                            className="px-5 py-2 text-xs font-black text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? (
                                <><Loader2 className="size-3.5 animate-spin" /> Applying...</>
                            ) : (
                                <>Apply {type === 'credit' ? `+${classesCount}` : `-${classesCount}`} Adjustment</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
