'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, Lightbulb, AlertCircle } from 'lucide-react';

interface ForgottenClass {
    classroom_id: string;
    classroom_name: string;
    date: string;
    dayName: string;
}

interface PriorityTasksWidgetProps {
    stats: { pendingSubmissions: number };
    forgottenClasses: ForgottenClass[];
    isAdmin: boolean;
    unassignedStudents?: { id: string; name: string }[];
    pendingLeaves?: { id: string; student_name: string; classroom_name: string; class_date: string; reason: string }[];
    pendingPayments?: { id: string; student_id: string; student_name: string; amount: number; payment_date: string }[];
    dueStudents?: { student_id: string; student_name: string; reason: string; fees_amount: number }[];
    pendingSubmissionsList?: { id: string; student_name: string; task_title: string; submitted_at: string }[];
}

interface TaskItem {
    type: 'payment' | 'submission' | 'unassigned' | 'excuse' | 'attendance' | 'fee_due';
    id: string;
    title: string;
    subtitle: string;
    actionText: string;
    actionHref: string;
    urgent: boolean;
}

const TIPS = [
    'Consistency is the key to mastering the flute. Encourage students to practice for at least 15 minutes daily.',
    'A student who records themselves often progresses twice as fast — listening is the secret half of learning.',
    'Introduce ragas in small, memorable fragments before teaching the full structure.',
];

export default function PriorityTasksWidget({
    stats,
    forgottenClasses,
    isAdmin,
    unassignedStudents = [],
    pendingLeaves = [],
    pendingPayments = [],
    dueStudents = [],
    pendingSubmissionsList = []
}: PriorityTasksWidgetProps) {
    const tip = TIPS[new Date().getDay() % TIPS.length];

    // Build the tasks array dynamically
    const tasks: TaskItem[] = [];

    // 1. Pending Payments (Verify payment)
    if (isAdmin) {
        pendingPayments.forEach(p => {
            tasks.push({
                type: 'payment',
                id: `pay-${p.id}`,
                title: `Verify ₹${p.amount} payment`,
                subtitle: `Received from ${p.student_name}`,
                actionText: 'Verify',
                actionHref: '/teacher-dashboard/fees',
                urgent: true
            });
        });
    }

    // 2. Task submission validation (Submissions awaiting review)
    if (pendingSubmissionsList.length > 0) {
        pendingSubmissionsList.forEach(sub => {
            tasks.push({
                type: 'submission',
                id: `sub-${sub.id}`,
                title: `Review: ${sub.task_title}`,
                subtitle: `Submitted by ${sub.student_name}`,
                actionText: 'Review',
                actionHref: '/teacher-dashboard/submissions',
                urgent: true
            });
        });
    } else if (stats.pendingSubmissions > 0) {
        tasks.push({
            type: 'submission',
            id: 'sub-general',
            title: `Review pending tasks`,
            subtitle: `${stats.pendingSubmissions} student submission(s) awaiting review`,
            actionText: 'Review',
            actionHref: '/teacher-dashboard/submissions',
            urgent: true
        });
    }

    // 3. Unassigned Students (Admin only)
    if (isAdmin) {
        unassignedStudents.forEach(stud => {
            tasks.push({
                type: 'unassigned',
                id: `stud-${stud.id}`,
                title: `Assign student to class`,
                subtitle: `${stud.name} has no assigned classroom`,
                actionText: 'Assign',
                actionHref: '/teacher-dashboard/students',
                urgent: false
            });
        });
    }

    // 4. Excuse Requests (Leave requests)
    pendingLeaves.forEach(leave => {
        tasks.push({
            type: 'excuse',
            id: `leave-${leave.id}`,
            title: `Excuse: ${leave.student_name}`,
            subtitle: `${leave.classroom_name} class on ${new Date(leave.class_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
            actionText: 'Review',
            actionHref: '/teacher-dashboard/attendance',
            urgent: true
        });
    });

    // 5. Missed Attendance (forgotten classes)
    forgottenClasses.forEach((item, idx) => {
        tasks.push({
            type: 'attendance',
            id: `att-${idx}`,
            title: `Mark Missed Attendance`,
            subtitle: `${item.classroom_name} (${item.dayName})`,
            actionText: 'Mark',
            actionHref: `/teacher-dashboard/attendance?date=${item.date}&classId=${item.classroom_id}`,
            urgent: true
        });
    });

    // 6. Fees Due / Overdue (Admin only)
    if (isAdmin) {
        dueStudents.forEach(stud => {
            tasks.push({
                type: 'fee_due',
                id: `fee-${stud.student_id}`,
                title: `Collect fees: ${stud.student_name}`,
                subtitle: `${stud.reason} (₹${stud.fees_amount})`,
                actionText: 'Remind',
                actionHref: '/teacher-dashboard/fees',
                urgent: stud.reason.toLowerCase().includes('overdue')
            });
        });
    }

    const hasUrgent = tasks.some(t => t.urgent);

    return (
        <div className="bg-[#0d5e5b] p-4 sm:p-6 rounded-2xl shadow-xl shadow-[#0d5e5b]/20 text-white relative overflow-hidden group text-left">
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <AlertCircle className="w-24 h-24 text-white" />
            </div>
            
            <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <span className={`size-3 rounded-full inline-block ${hasUrgent ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`} aria-hidden="true" />
                        <h3 className="font-display text-base font-bold text-white">Priority Tasks</h3>
                    </div>
                    {tasks.length > 0 ? (
                        <span className="bg-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Urgent ({tasks.length})
                        </span>
                    ) : (
                        <span className="bg-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            All clear
                        </span>
                    )}
                </div>

                {tasks.length > 0 ? (
                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                        {tasks.map((task) => (
                            <div key={task.id} className="flex items-center justify-between bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/5 text-xs hover:bg-white/15 transition-all animate-in fade-in duration-200">
                                <div className="min-w-0 flex-1 pr-2 text-left">
                                    <div className="flex items-center gap-1.5 font-bold">
                                        {task.urgent && <span className="size-1.5 rounded-full bg-red-400 shrink-0 animate-pulse" />}
                                        <p className="truncate text-white text-sm font-semibold">{task.title}</p>
                                    </div>
                                    <p className="text-[10px] text-teal-100/70 mt-0.5 truncate font-medium">{task.subtitle}</p>
                                </div>
                                <Link 
                                    href={task.actionHref} 
                                    className="bg-[#ecb613] hover:bg-white text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 shadow-sm"
                                >
                                    {task.actionText}
                                    <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 py-8 text-center bg-white/5 rounded-xl border border-white/5">
                        <CheckCircle2 className="w-8 h-8 text-teal-200" />
                        <p className="text-sm font-semibold text-teal-50">You're all caught up!</p>
                        <p className="text-xs text-teal-200/60 max-w-[200px]">No pending reviews, payments, excuse requests, or unassigned students.</p>
                    </div>
                )}

                {/* Tip section at the bottom */}
                <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-3.5 h-3.5 text-[#ecb613]" aria-hidden="true" />
                        <span className="text-[10px] font-bold tracking-widest uppercase text-teal-200/75">
                            Teacher's Tip
                        </span>
                    </div>
                    <p className="text-xs text-teal-50 leading-relaxed italic">"{tip}"</p>
                </div>
            </div>
        </div>
    );
}
