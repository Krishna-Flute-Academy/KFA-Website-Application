import React, { useState } from 'react';
import { CreditCard, History, Clock, CheckCircle, AlertTriangle, Send, Loader2 } from 'lucide-react';
import { supabaseAuth } from '../../lib/supabase-auth';
import { getStudentFeeStatus, calculateClassesAdded } from '../../lib/fee-utils';

interface FeesTabProps {
    profile: any;
    payments: any[];
    refreshData: () => void;
}

export default function FeesTab({ profile, payments, refreshData }: FeesTabProps) {
    const [isReporting, setIsReporting] = useState(false);
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('UPI');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const feeStatus = getStudentFeeStatus(profile?.fees_basis, profile?.fees_collection_date, payments);
    const classesLeft = profile?.fees_classes_paid || 0;
    const monthlyFee = profile?.fees_amount || 0;
    
    // Sort payments by date descending
    const sortedPayments = [...payments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const handleReportPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabaseAuth.from('fees_payments').insert({
                student_id: profile.id,
                amount: Number(amount),
                payment_method: paymentMethod,
                payment_date: new Date().toISOString().split('T')[0],
                notes: notes,
                status: 'pending_approval' // This triggers the teacher review flow
            });

            if (error) throw error;
            
            setSuccessMsg('Payment reported successfully! Your teacher will verify and update your balance soon.');
            setAmount('');
            setNotes('');
            setIsReporting(false);
            refreshData();
            
            setTimeout(() => setSuccessMsg(''), 5000);
        } catch (error) {
            console.error('Error reporting payment:', error);
            alert('Failed to report payment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Fees & Payments</h1>
                <p className="text-sm md:text-base text-slate-500 mt-2 font-medium">Manage your class balance and payment history.</p>
            </div>

            {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold text-sm">{successMsg}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Left Column: Status & Balance */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Current Balance Card */}
                    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/40 border border-slate-100 relative overflow-hidden">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#ecb613]/10 rounded-full blur-3xl pointer-events-none"></div>
                        
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-100">
                                <CreditCard className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Current Balance</h3>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    {profile?.fees_basis === 'monthly' ? 'Monthly Plan' : 'Per Class Plan'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4">
                            <div className="flex items-baseline gap-2">
                                <span className={`text-5xl font-black ${classesLeft < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                    {Math.max(0, classesLeft)}
                                </span>
                                <span className="text-sm font-bold text-slate-400">Classes Left</span>
                            </div>
                            
                            {classesLeft < 0 && (
                                <p className="text-xs font-bold text-rose-600 mt-2">
                                    You have {-classesLeft} unpaid past class{-classesLeft > 1 ? 'es' : ''}.
                                </p>
                            )}
                            
                            {feeStatus?.hasPendingPayment && (
                                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-100">
                                    <Clock className="w-3.5 h-3.5" /> Pending Verification
                                </div>
                            )}

                            {classesLeft <= 1 && !feeStatus?.hasPendingPayment && (
                                <div className={`mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg border ${
                                    classesLeft <= 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                    <AlertTriangle className="w-3.5 h-3.5" /> 
                                    {classesLeft <= 0 ? 'Overdue - Please Pay' : 'Due Soon - 1 Class Left'}
                                </div>
                            )}
                        </div>

                        {!isReporting ? (
                            <button 
                                onClick={() => setIsReporting(true)}
                                className="mt-8 w-full bg-[#ecb613] hover:bg-[#d4a000] text-slate-900 font-bold py-3.5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                            >
                                <CheckCircle className="w-4 h-4" /> Report Payment
                            </button>
                        ) : (
                            <button 
                                onClick={() => setIsReporting(false)}
                                className="mt-8 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl transition-all shadow-sm active:scale-95"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Column: Dynamic Form or History */}
                <div className="lg:col-span-2 space-y-6">
                    {isReporting ? (
                        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/40 border border-slate-100 animate-in slide-in-from-right-4 duration-300">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-6">
                                <Send className="w-5 h-5 text-amber-500" />
                                Submit Payment Details
                            </h2>
                            <p className="text-sm text-slate-500 mb-8 max-w-lg">
                                Have you already paid your fees to the academy? Enter the details below. Once verified, {monthlyFee > 0 ? `paying ₹${monthlyFee} adds 4 classes to your balance.` : 'your balance will be updated.'}
                            </p>
                            
                            <form onSubmit={handleReportPayment} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Amount Paid (₹)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                        <input 
                                            type="number" 
                                            required
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none font-bold text-slate-900"
                                            placeholder="e.g. 2500"
                                        />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Payment Method</label>
                                        <select 
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none font-semibold text-slate-900"
                                        >
                                            <option value="UPI">UPI / GPay / PhonePe</option>
                                            <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                                            <option value="Cash">Cash (In-person)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Date Paid</label>
                                        <input 
                                            type="date" 
                                            readOnly
                                            value={new Date().toISOString().split('T')[0]}
                                            className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl outline-none font-semibold text-slate-500 cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Transaction ID / Notes</label>
                                    <textarea 
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#ecb613] focus:border-[#ecb613] outline-none font-medium text-slate-900 resize-none"
                                        placeholder="e.g. UTR Number, phone number used, or any notes for the teacher..."
                                    />
                                </div>

                                <div className="pt-4 flex items-center justify-end gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => setIsReporting(false)}
                                        className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={isSubmitting || !amount}
                                        className="bg-[#ecb613] hover:bg-[#d4a000] text-slate-900 font-bold px-8 py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                    >
                                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        Submit
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/40 border border-slate-100">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-6">
                                <History className="w-5 h-5 text-slate-400" />
                                Payment History
                            </h2>
                            
                            {sortedPayments.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                    <History className="w-12 h-12 mb-3 text-slate-300" />
                                    <p className="font-semibold">No payment records found.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {sortedPayments.map((payment) => (
                                        <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-amber-200 transition-colors gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                                    payment.status === 'pending_approval' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                                                }`}>
                                                    {payment.status === 'pending_approval' ? <Clock className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 text-base">₹{payment.amount}</p>
                                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                                        {new Date(payment.payment_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} • {payment.payment_method}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center sm:justify-end">
                                                <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border ${
                                                    payment.status === 'pending_approval' 
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                }`}>
                                                    {payment.status === 'pending_approval' ? 'Reviewing' : 'Approved'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
