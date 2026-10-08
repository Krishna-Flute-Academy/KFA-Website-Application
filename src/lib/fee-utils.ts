export type FinancialState = 'GOOD_STANDING' | 'FEE_DUE' | 'PAYMENT_OVERDUE';

export interface AuthoritativeFeeStatus {
    studentId: string;
    totalPurchasedCredits: number;
    totalConsumedCredits: number;
    effectiveBalance: number;
    financialState: FinancialState;
    canJoinLiveClass: boolean;
    lastPaymentDate?: string;
    lastPaymentAmount?: number;
    needsReconciliation?: boolean;
    reconciliationReason?: string;
}

export interface FeeStatusDetails {
    dueDate: Date;         // The active due date being tracked
    diffDays: number;       // Difference in days (dueDate - today)
    status: 'good' | 'upcoming' | 'due' | 'overdue' | 'paused';
    formattedDueDate: string; 
    hasPendingPayment?: boolean; // If they have submitted a payment that is awaiting approval
    isPaused?: boolean;
    hasPrePauseDebt?: boolean;
    prePauseDueDate?: Date;
    unpaidCyclesCount?: number;
    earliestUnpaidDueDate?: Date;
    financialState?: FinancialState;
    effectiveBalance?: number;
    canJoinLiveClass?: boolean;
}

/**
 * Calculates how many classes a student should get based on the amount they paid
 * relative to their configured fee structure (monthly vs per-class).
 */
export function calculateClassesAdded(amountPaid: number, feeAmount: number, feesBasis: string = 'monthly'): number {
    if (!feeAmount || feeAmount <= 0) return 0;

    if (feesBasis === 'class') {
        // For class-basis, feeAmount is the cost per single class.
        // e.g., ₹500 fee per class. If they pay ₹500, they get 1 class.
        const classes = Math.floor(amountPaid / feeAmount);
        return classes > 0 ? classes : 1;
    }

    // For monthly subscription, feeAmount covers 4 classes per month.
    // e.g., ₹2500 monthly / 4 = ₹625 per class.
    const costPerClass = feeAmount / 4;
    return Math.floor(amountPaid / costPerClass);
}

/**
 * Plays a pleasant notification chime using the browser's Web Audio API.
 * Requires user interaction beforehand (which is standard for dashboards).
 */
export function playNotificationSound() {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.type = 'sine';
        
        // Notification chime: High C to High E
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        
        // Volume envelope
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
        console.error("Audio API failed to play sound", e);
    }
}

/**
 * Calculates the first fee due date on or after a student resumes learning.
 * Ensures the student is never back-billed for paused months.
 */
export function calculateResumedFeeDueDate(
    resumeDate: Date | string,
    collectionDay: number = 1
): Date {
    const rDate = typeof resumeDate === 'string' ? new Date(resumeDate) : new Date(resumeDate.getTime());
    rDate.setHours(0, 0, 0, 0);

    const safeDay = Math.min(Math.max(Number(collectionDay) || 1, 1), 31);
    const year = rDate.getFullYear();
    const month = rDate.getMonth();

    const getClamped = (yr: number, mo: number, day: number) => {
        const d = new Date(yr, mo, day);
        if (d.getMonth() !== (mo + 12) % 12) {
            return new Date(yr, mo + 1, 0);
        }
        return d;
    };

    let targetDue = getClamped(year, month, safeDay);
    targetDue.setHours(0, 0, 0, 0);

    if (targetDue.getTime() < rDate.getTime()) {
        targetDue = getClamped(year, month + 1, safeDay);
        targetDue.setHours(0, 0, 0, 0);
    }

    return targetDue;
}

export interface BillingCycleSlot {
    index: number;
    cycleStart: string;          // YYYY-MM-DD
    cycleStartDate: Date;
    cycleEnd: string;            // YYYY-MM-DD
    nextDueDate: string;         // YYYY-MM-DD
    dueDate: string;             // YYYY-MM-DD (collection due date for this cycle)
    dueDateObj: Date;
    isPaid: boolean;
    isLate: boolean;
    isPaused?: boolean;
    allocatedPayment?: any;
    paymentStatus: 'paid_on_time' | 'paid_late' | 'overdue' | 'due' | 'upcoming' | 'future' | 'paused';
}

/**
 * Helper to find which collection due date is closest to a given payment date.
 */
export function getClosestDueDate(pDate: Date, cDay: number): Date {
    const pYear = pDate.getFullYear();
    const pMonth = pDate.getMonth();
    const options = [
        getClampedMonthDate(pYear, pMonth - 1, cDay),
        getClampedMonthDate(pYear, pMonth, cDay),
        getClampedMonthDate(pYear, pMonth + 1, cDay)
    ];
    let closest = options[0];
    let minDiff = Math.abs(pDate.getTime() - options[0].getTime());
    for (let i = 1; i < options.length; i++) {
        const diff = Math.abs(pDate.getTime() - options[i].getTime());
        if (diff < minDiff) {
            minDiff = diff;
            closest = options[i];
        }
    }
    closest.setHours(0, 0, 0, 0);
    return closest;
}

/**
 * Helper to get the cycle containing a given date.
 * Half-open interval [cycleStart, nextDueDate).
 */
export function getCycleContainingDate(d: Date, collectionDay: number): { cycleStart: Date; nextDueDate: Date; dueDate: Date } {
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const day = d.getDate();

    let cycleStart: Date;
    let nextDueDate: Date;

    if (day >= collectionDay) {
        cycleStart = getClampedMonthDate(yr, mo, collectionDay);
        nextDueDate = getClampedMonthDate(yr, mo + 1, collectionDay);
    } else {
        cycleStart = getClampedMonthDate(yr, mo - 1, collectionDay);
        nextDueDate = getClampedMonthDate(yr, mo, collectionDay);
    }
    cycleStart.setHours(0, 0, 0, 0);
    nextDueDate.setHours(0, 0, 0, 0);
    const dueDate = new Date(cycleStart);
    return { cycleStart, nextDueDate, dueDate };
}

/**
 * Builds all chronological billing cycles for a student and allocates approved payments via FIFO.
 * Oldest unpaid cycle is settled first before payments advance to subsequent cycles.
 */
export function buildStudentBillingCycles(
    feesCollectionDay: number | null | undefined,
    payments: { payment_date: string; status?: string; classes_added?: number; allocated_due_date?: string; notes?: string | null }[] = [],
    today: Date = new Date(),
    joinDate?: string | Date | null,
    studentStatus?: string | null,
    pauseEffectiveDate?: string | Date | null,
    resumeDate?: string | Date | null
): {
    cycles: BillingCycleSlot[];
    approvedPayments: typeof payments;
    isPaused: boolean;
    pauseDate: Date | null;
    collectionDay: number;
    todayZero: Date;
} {
    const isPaused = (studentStatus || '').toLowerCase().trim() === 'inactive' || (studentStatus || '').toLowerCase().trim() === 'paused';

    let collectionDay = Number(feesCollectionDay);
    if (!collectionDay || isNaN(collectionDay) || collectionDay < 1 || collectionDay > 31) {
        if (joinDate) {
            const jDate = new Date(joinDate);
            collectionDay = !isNaN(jDate.getTime()) ? jDate.getDate() : 1;
        } else {
            collectionDay = 1;
        }
    }

    const todayZero = new Date(today);
    todayZero.setHours(0, 0, 0, 0);

    const approvedPayments = payments
        .filter(p => !p.status || p.status === 'approved')
        .slice()
        .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());

    // Determine current month's collection due date
    const currDueDate = getClampedMonthDate(todayZero.getFullYear(), todayZero.getMonth(), collectionDay);
    currDueDate.setHours(0, 0, 0, 0);

    // Determine initial cycle start date
    let startDue: Date;
    if (resumeDate) {
        startDue = calculateResumedFeeDueDate(resumeDate, collectionDay);
    } else {
        const candidateDates: Date[] = [];
        let p0Due: Date | null = null;
        if (approvedPayments.length > 0) {
            const p0Date = new Date(approvedPayments[0].payment_date);
            p0Date.setHours(0, 0, 0, 0);
            p0Due = getClosestDueDate(p0Date, collectionDay);
            candidateDates.push(p0Due);
        }

        if (joinDate) {
            const jDate = new Date(joinDate);
            if (!isNaN(jDate.getTime())) {
                jDate.setHours(0, 0, 0, 0);
                let jDue = getClampedMonthDate(jDate.getFullYear(), jDate.getMonth(), collectionDay);
                jDue.setHours(0, 0, 0, 0);
                if (jDue.getTime() < jDate.getTime()) {
                    const hasEarlyPay = approvedPayments.some(p => {
                        const pd = new Date(p.payment_date);
                        pd.setHours(0, 0, 0, 0);
                        return pd.getTime() <= jDue.getTime() + 15 * 86400000;
                    });
                    if (!hasEarlyPay) {
                        jDue = getClampedMonthDate(jDue.getFullYear(), jDue.getMonth() + 1, collectionDay);
                        jDue.setHours(0, 0, 0, 0);
                    }
                }
                // Only consider joinDate as start if it is not excessively ancient relative to earliest payment
                if (!p0Due || jDue.getTime() >= p0Due.getTime() - 62 * 86400000) {
                    candidateDates.push(jDue);
                }
            }
        }

        if (candidateDates.length > 0) {
            candidateDates.sort((a, b) => a.getTime() - b.getTime());
            startDue = candidateDates[0];
        } else {
            startDue = currDueDate;
        }
    }

    let curY = startDue.getFullYear();
    let curM = startDue.getMonth();
    const endY = Math.max(todayZero.getFullYear(), curY);
    const endM = Math.max(todayZero.getMonth() + 2, curM + 2);

    const cycles: BillingCycleSlot[] = [];
    let cycleIndex = 0;
    while ((curY * 12 + curM) <= (endY * 12 + endM)) {
        const dueDate = getClampedMonthDate(curY, curM, collectionDay);
        dueDate.setHours(0, 0, 0, 0);
        const nextDueDate = getClampedMonthDate(curY, curM + 1, collectionDay);
        nextDueDate.setHours(0, 0, 0, 0);

        let cycleStart = dueDate;
        if (cycleIndex === 0 && joinDate) {
            const jDate = new Date(joinDate);
            jDate.setHours(0, 0, 0, 0);
            if (jDate.getTime() > cycleStart.getTime() && jDate.getTime() < nextDueDate.getTime()) {
                cycleStart = jDate;
            }
        }

        cycles.push({
            index: cycleIndex++,
            cycleStart: formatDateToYYYYMMDD(cycleStart),
            cycleStartDate: cycleStart,
            cycleEnd: formatDateToYYYYMMDD(nextDueDate),
            nextDueDate: formatDateToYYYYMMDD(nextDueDate),
            dueDate: formatDateToYYYYMMDD(dueDate),
            dueDateObj: dueDate,
            isPaid: false,
            isLate: false,
            paymentStatus: 'future'
        });

        curM++;
        if (curM > 11) { curY++; curM = 0; }
    }

    let pauseDate: Date | null = null;
    if (pauseEffectiveDate) {
        pauseDate = new Date(pauseEffectiveDate);
        pauseDate.setHours(0, 0, 0, 0);
    }

    const rTime = resumeDate ? new Date(resumeDate).getTime() : null;
    const pTime = pauseDate ? pauseDate.getTime() : null;

    // Suppress cycles that fall within a paused interval
    for (const c of cycles) {
        if (pTime !== null && rTime !== null) {
            if (c.dueDateObj.getTime() >= pTime && c.dueDateObj.getTime() < rTime) {
                c.isPaused = true;
                c.paymentStatus = 'paused';
            }
        } else if (pTime !== null && isPaused) {
            if (c.dueDateObj.getTime() >= pTime) {
                c.isPaused = true;
                c.paymentStatus = 'paused';
            }
        }
    }

    // Allocate approved payments chronologically using FIFO
    for (const p of approvedPayments) {
        const pDate = new Date(p.payment_date);
        pDate.setHours(0, 0, 0, 0);

        // 1. Check if payment explicitly targets a due date
        let targetCycle: BillingCycleSlot | undefined;
        const explicitTarget = (p as any).allocated_due_date || (p as any).billing_cycle_due_date;
        if (explicitTarget) {
            const expDateStr = String(explicitTarget).split('T')[0];
            targetCycle = cycles.find(c => c.dueDate === expDateStr && !c.isPaid);
        }

        // 2. Otherwise allocate to earliest unallocated cycle (respecting pause and resume constraints)
        if (!targetCycle) {
            if (rTime !== null && pDate.getTime() >= rTime) {
                // Payments made on or after resume date must allocate to cycles on or after resume date (never to pre-resume paused periods)
                targetCycle = cycles.find(c => !c.isPaid && !c.isPaused && c.dueDateObj.getTime() >= rTime);
                if (!targetCycle) {
                    targetCycle = cycles.find(c => !c.isPaid && !c.isPaused);
                }
            } else {
                targetCycle = cycles.find(c => !c.isPaid && !c.isPaused && (!pauseDate || c.dueDateObj.getTime() <= pauseDate.getTime()));
            }
        }

        if (targetCycle) {
            targetCycle.isPaid = true;
            targetCycle.allocatedPayment = p;
            if (pDate.getTime() > targetCycle.dueDateObj.getTime()) {
                targetCycle.isLate = true;
                targetCycle.paymentStatus = 'paid_late';
            } else {
                targetCycle.isLate = false;
                targetCycle.paymentStatus = 'paid_on_time';
            }
        }
    }

    // Mark remaining unpaid cycles relative to today
    for (const c of cycles) {
        if (!c.isPaid && !c.isPaused) {
            const diff = Math.ceil((c.dueDateObj.getTime() - todayZero.getTime()) / (1000 * 60 * 60 * 24));
            if (diff < 0) c.paymentStatus = 'overdue';
            else if (diff === 0) c.paymentStatus = 'due';
            else if (diff <= 3) c.paymentStatus = 'upcoming';
            else c.paymentStatus = 'future';
        }
    }

    return {
        cycles,
        approvedPayments,
        isPaused,
        pauseDate,
        collectionDay,
        todayZero
    };
}

/**
 * Calculates a student's monthly fee due date and payment status using FIFO cycle allocation.
 */
export function getStudentFeeStatus(
    feesBasis: string | null | undefined,
    feesCollectionDay: number | null | undefined,
    payments: { payment_date: string, status?: string }[],
    today: Date = new Date(),
    joinDate?: string | Date | null,
    studentStatus?: string | null,
    pauseEffectiveDate?: string | Date | null,
    resumeDate?: string | Date | null,
    effectiveBalance?: number
): FeeStatusDetails | null {
    if (feesBasis !== 'monthly') {
        return null;
    }

    if (!feesCollectionDay && !joinDate) {
        return null;
    }

    const {
        cycles,
        isPaused,
        pauseDate,
        todayZero
    } = buildStudentBillingCycles(
        feesCollectionDay,
        payments,
        today,
        joinDate,
        studentStatus,
        pauseEffectiveDate,
        resumeDate
    );

    const hasPendingPayment = payments.some(p => p.status === 'pending_approval');

    // Authoritative class-credit integration: If balance is positive, student is in good standing!
    if (typeof effectiveBalance === 'number' && effectiveBalance > 0) {
        const nextUnpaidCycle = cycles.find(c => !c.isPaid) || cycles[cycles.length - 1];
        const nextDueObj = nextUnpaidCycle ? nextUnpaidCycle.dueDateObj : todayZero;
        const day = nextDueObj.getDate();
        const monthName = nextDueObj.toLocaleString('en-US', { month: 'long' });
        return {
            dueDate: nextDueObj,
            diffDays: Math.ceil((nextDueObj.getTime() - todayZero.getTime()) / (1000 * 60 * 60 * 24)),
            status: 'good',
            formattedDueDate: `${day} ${monthName}`,
            hasPendingPayment,
            isPaused: false,
            unpaidCyclesCount: 0
        };
    }

    if (isPaused) {
        let hasPrePauseDebt = false;
        let prePauseDueDate: Date | undefined;
        if (pauseDate) {
            const unpaidPrePause = cycles.filter(c => !c.isPaid && c.dueDateObj.getTime() <= pauseDate.getTime());
            if (unpaidPrePause.length > 0) {
                hasPrePauseDebt = true;
                prePauseDueDate = unpaidPrePause[0].dueDateObj;
            }
        }

        let formattedDueDate = 'Billing Paused';
        if (hasPrePauseDebt && prePauseDueDate) {
            const preDay = prePauseDueDate.getDate();
            const preMonth = prePauseDueDate.toLocaleString('en-US', { month: 'long' });
            formattedDueDate = `Paused (Unpaid Pre-Pause Balance: Due ${preDay} ${preMonth})`;
        }

        return {
            dueDate: prePauseDueDate || todayZero,
            diffDays: 0,
            status: 'paused',
            formattedDueDate,
            hasPendingPayment,
            isPaused: true,
            hasPrePauseDebt,
            prePauseDueDate
        };
    }

    // Active student: Check for past unpaid billing cycles (FIFO debt detection)
    // Filter out cycles that occurred during a paused period or before resumeDate
    const rTime = resumeDate ? new Date(resumeDate).getTime() : null;
    const unpaidPastCycles = cycles.filter(c => 
        !c.isPaid && 
        !c.isPaused && 
        c.paymentStatus !== 'paused' && 
        c.dueDateObj.getTime() < todayZero.getTime() &&
        (!rTime || c.dueDateObj.getTime() >= rTime)
    );
    if (unpaidPastCycles.length > 0) {
        const earliest = unpaidPastCycles[0];
        const diffDays = Math.ceil((earliest.dueDateObj.getTime() - todayZero.getTime()) / (1000 * 60 * 60 * 24));
        const day = earliest.dueDateObj.getDate();
        const monthName = earliest.dueDateObj.toLocaleString('en-US', { month: 'long' });
        return {
            dueDate: earliest.dueDateObj,
            diffDays,
            status: 'overdue',
            formattedDueDate: `${day} ${monthName}`,
            hasPendingPayment,
            isPaused: false,
            unpaidCyclesCount: unpaidPastCycles.length,
            earliestUnpaidDueDate: earliest.dueDateObj
        };
    }

    // No past overdue cycles: evaluate next cycle to pay
    const nextUnpaidCycle = cycles.find(c => !c.isPaid) || cycles[cycles.length - 1];
    const diffTime = nextUnpaidCycle.dueDateObj.getTime() - todayZero.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status: 'good' | 'upcoming' | 'due' | 'overdue' = 'good';
    if (diffDays < 0) {
        status = 'overdue';
    } else if (diffDays === 0) {
        status = 'due';
    } else if (diffDays <= 3) {
        status = 'upcoming';
    } else {
        status = 'good';
    }

    const day = nextUnpaidCycle.dueDateObj.getDate();
    const monthName = nextUnpaidCycle.dueDateObj.toLocaleString('en-US', { month: 'long' });

    return {
        dueDate: nextUnpaidCycle.dueDateObj,
        diffDays,
        status,
        formattedDueDate: `${day} ${monthName}`,
        hasPendingPayment,
        isPaused: false,
        unpaidCyclesCount: 0
    };
}

export function formatDateToYYYYMMDD(d: Date): string {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
}

export function getClampedMonthDate(yr: number, mo: number, day: number): Date {
    const date = new Date(yr, mo, day);
    if (date.getMonth() !== (mo + 12) % 12) {
        return new Date(yr, mo + 1, 0);
    }
    return date;
}

export interface StudentBillingCycle {
    cycleStart: string;          // YYYY-MM-DD
    cycleEnd: string;            // YYYY-MM-DD (nextDueDate)
    nextDueDate: string;         // YYYY-MM-DD
    dueDate?: string;            // YYYY-MM-DD (collection due date for this cycle)
    formattedDueDate: string;    // e.g. "13 September"
    daysRemaining: number;
    feeStatus: 'good' | 'upcoming' | 'due' | 'overdue' | 'paused';
    hasPendingPayment: boolean;
    isPaused?: boolean;
    hasPrePauseDebt?: boolean;
    prePauseDueDate?: string;
    isPaid?: boolean;
    isLatePayment?: boolean;
    allocatedPayment?: any;
    unpaidCyclesCount?: number;
}

/**
 * Derives the active half-open billing cycle [cycleStart, nextDueDate) for a student using FIFO allocation.
 */
export function getStudentBillingCycle(
    feesCollectionDay: number | null | undefined,
    payments: { payment_date: string; status?: string; classes_added?: number }[] = [],
    today: Date = new Date(),
    joinDate?: string | Date | null,
    studentStatus?: string | null,
    pauseEffectiveDate?: string | Date | null,
    resumeDate?: string | Date | null,
    effectiveBalance?: number
): StudentBillingCycle {
    const {
        cycles,
        isPaused,
        pauseDate,
        collectionDay,
        todayZero
    } = buildStudentBillingCycles(
        feesCollectionDay,
        payments,
        today,
        joinDate,
        studentStatus,
        pauseEffectiveDate,
        resumeDate
    );

    const hasPendingPayment = payments.some(p => p.status === 'pending_approval');

    if (isPaused) {
        let hasPrePauseDebt = false;
        let prePauseDueDateStr: string | undefined;
        if (pauseDate) {
            const unpaidPrePause = cycles.filter(c => !c.isPaid && c.dueDateObj.getTime() <= pauseDate.getTime());
            if (unpaidPrePause.length > 0) {
                hasPrePauseDebt = true;
                prePauseDueDateStr = unpaidPrePause[0].dueDate;
            }
        }

        let formattedDueDate = 'Billing Paused';
        if (hasPrePauseDebt && prePauseDueDateStr) {
            const [pYr, pMo, pDa] = prePauseDueDateStr.split('-').map(Number);
            const pDateObj = new Date(pYr, pMo - 1, pDa);
            const pDay = pDateObj.getDate();
            const pMonth = pDateObj.toLocaleString('en-US', { month: 'long' });
            formattedDueDate = `Paused (Unpaid Pre-Pause Balance: Due ${pDay} ${pMonth})`;
        }

        const fallbackDue = getClampedMonthDate(todayZero.getFullYear(), todayZero.getMonth(), collectionDay);
        const fallbackNext = getClampedMonthDate(todayZero.getFullYear(), todayZero.getMonth() + 1, collectionDay);

        return {
            cycleStart: formatDateToYYYYMMDD(fallbackDue),
            cycleEnd: formatDateToYYYYMMDD(fallbackNext),
            nextDueDate: formatDateToYYYYMMDD(fallbackNext),
            dueDate: formatDateToYYYYMMDD(fallbackDue),
            formattedDueDate,
            daysRemaining: 0,
            feeStatus: 'paused',
            hasPendingPayment,
            isPaused: true,
            hasPrePauseDebt,
            prePauseDueDate: prePauseDueDateStr
        };
    }

    // Active student: Select the billing cycle covering today
    const currentCalCycle = getCycleContainingDate(todayZero, collectionDay);
    const activeSlot = cycles.find(c => c.dueDateObj.getTime() === currentCalCycle.dueDate.getTime())
        || cycles.find(c => c.cycleStartDate.getTime() <= todayZero.getTime() && todayZero.getTime() < new Date(c.nextDueDate).getTime())
        || cycles[cycles.length - 1];

    const statusDetails = getStudentFeeStatus(
        'monthly',
        collectionDay,
        payments,
        today,
        joinDate,
        studentStatus,
        pauseEffectiveDate,
        resumeDate,
        effectiveBalance
    );

    const feeStatus = statusDetails ? statusDetails.status : 'good';
    const formattedDueDate = statusDetails ? statusDetails.formattedDueDate : activeSlot.dueDate;
    const daysRemaining = statusDetails ? statusDetails.diffDays : 0;

    return {
        cycleStart: activeSlot.cycleStart,
        cycleEnd: activeSlot.nextDueDate,
        nextDueDate: activeSlot.nextDueDate,
        dueDate: activeSlot.dueDate,
        formattedDueDate,
        daysRemaining,
        feeStatus,
        hasPendingPayment,
        isPaused: false,
        isPaid: activeSlot.isPaid,
        isLatePayment: activeSlot.isLate,
        allocatedPayment: activeSlot.allocatedPayment,
        unpaidCyclesCount: statusDetails?.unpaidCyclesCount || 0
    };
}

export interface StudentFeeCycleMetrics {
    studentId: string;
    feesBasis: 'monthly' | 'class';
    basis: 'monthly' | 'class'; // Alias for feesBasis

    // Cycle Boundaries [cycleStart <= classDate < nextDueDate)
    cycleStart: string;              // e.g. "2026-08-13"
    nextDueDate: string;             // e.g. "2026-09-13"
    formattedDueDate: string;        // e.g. "13 September"

    // Core Entitlements & Balance
    entitledClasses: number;         // 4 for monthly; prepaid balance for class
    creditsRemaining: number;        // max(0, entitledClasses - regularAttended - unexcusedMissed - makeupsCompleted)
    classesAvailable: number;        // min(creditsRemaining, operationalOpportunities)

    // Breakdown Counts
    regularAttended: number;         // present or late in regular classroom
    unexcusedMissed: number;         // absent in regular classroom (burns credit)
    excusedMissed: number;           // excused in regular classroom (grants makeup eligibility)
    regularFuture: number;           // scheduled occurrences > today and < nextDueDate
    unresolvedSessions: number;      // past scheduled occurrences < today with no attendance/cancellation record
    cancelledSessions: number;       // confirmed teacher/academy cancelled sessions

    // Makeup Breakdown
    makeupsPending: number;          // excused absences needing makeup
    makeupsScheduled: number;        // excused absences with future override scheduled
    makeupsCompleted: number;        // makeups attended (present/late)
    makeupsExpired: number;          // makeups from past cycles not used
    validOutstandingMakeups: number; // makeupsPending + makeupsScheduled

    // Status Label & Visuals
    statusLabel: string;             // e.g. "1 Regular", "1 Makeup Pending", "Cycle Complete", "Attendance Review Needed"
    badgeVariant: 'good' | 'warning' | 'danger' | 'neutral';
    alertType?: 'unresolved' | 'due' | 'overdue';

    // Authoritative Financial Standing & Access
    effectiveBalance?: number;
    financialState?: FinancialState;
    canJoinLiveClass?: boolean;
    needsReconciliation?: boolean;
    reconciliationReason?: string;

    // Financial Standing & Payment Info
    isPaid?: boolean;
    isLatePayment?: boolean;
    paymentStatus?: 'good' | 'upcoming' | 'due' | 'overdue' | 'paused';
    allocatedPayment?: any;
    unpaidCyclesCount?: number;
}

export interface FeeCycleSessionItem {
    id: string;
    date: string;                     // YYYY-MM-DD
    displayDate: string;             // e.g. "08 Sep 2026"
    dayName: string;                 // e.g. "Tuesday"
    timeSlot?: string;               // e.g. "18:00 - 19:00"
    classroomId: string;
    classroomName: string;
    sessionType: 'regular' | 'makeup' | 'override';
    status:
        | 'attended'
        | 'absent'
        | 'excused'
        | 'makeup_attended'
        | 'makeup_scheduled'
        | 'makeup_pending'
        | 'makeup_unresolved'
        | 'unresolved'
        | 'upcoming'
        | 'cancelled';
    statusLabel: string;
    creditImpact: 'consumed' | 'not_consumed' | 'pending';
    creditImpactLabel: string;
    isDiscrepancy: boolean;
    discrepancyReason?: string;
    actionUrl?: string;
    actionLabel?: string;
    notes?: string;
    actualDate?: string;             // Physical attendance date if different
    onBehalfOfDate?: string;         // Scheduled target date if satisfied on behalf of
}

export interface FeeCycleDiagnostic {
    type: 'unresolved_session' | 'calculation_mismatch' | 'makeup_pending' | 'unresolved_makeup' | 'expired_cycle';
    severity: 'warning' | 'info' | 'danger';
    title: string;
    detail: string;
    affectedDate?: string;
    affectedClassroomId?: string;
    actionUrl?: string;
    actionLabel?: string;
}

export interface FeeCycleLedgerReport {
    studentId: string;
    feesBasis: 'monthly' | 'class';
    cycleStart: string;
    nextDueDate: string;
    formattedDueDate: string;
    daysRemaining: number;
    isPaid?: boolean;
    isLatePayment?: boolean;
    paymentStatus?: 'good' | 'upcoming' | 'due' | 'overdue' | 'paused';
    allocatedPayment?: any;
    unpaidCyclesCount?: number;
    canJoinLiveClass?: boolean;
    metrics: StudentFeeCycleMetrics;
    sessions: FeeCycleSessionItem[];
    diagnostics: FeeCycleDiagnostic[];
    summary: {
        entitledClasses: number;
        consumedClasses: number;       // regularAttended + unexcusedMissed + makeupsCompleted
        creditsRemaining: number;      // Financial unused credits (entitled - consumed)
        effectiveBalance?: number;
        financialState?: FinancialState;
        canJoinLiveClass?: boolean;
        needsReconciliation?: boolean;
        operationalOpportunities: number; // regularFuture + makeupsPending + makeupsScheduled
        unresolvedSessions: number;    // Past scheduled sessions without attendance/cancellation
        classesAvailable: number;      // min(creditsRemaining, operationalOpportunities)
        hasDiscrepancy: boolean;       // creditsRemaining > 0 && classesAvailable === 0 && unresolvedSessions > 0
    };
}

export interface StudentCycleCalculationInput {
    student: {
        id: string;
        name?: string;
        fees_basis?: string | null;
        fees_classes_paid?: number | null;
        fees_collection_date?: number | null;
        fees_amount?: number | null;
        join_date?: string | Date | null;
        next_due_date?: string | null;
        status?: string | null;
        pause_effective_date?: string | Date | null;
        resume_date?: string | Date | null;
    };
    pauseEffectiveDate?: string | Date | null;
    resumeDate?: string | Date | null;
    classrooms?: { id: string; name?: string; type?: string; joined_at?: string | null }[];
    batchSchedules?: { classroom_id: string; day_of_week: number; start_time?: string; end_time?: string }[];
    attendance?: { id?: string; student_id?: string; classroom_id: string; date?: string; session_date?: string; status: string; on_behalf_of_date?: string | null; classroom_name?: string }[];
    overrides?: { id?: string; student_id?: string; target_classroom_id: string; override_date: string; missed_session_date?: string | null; credit_treatment?: string | null; reason?: string | null }[];
    leaveRequests?: { id?: string; student_id?: string; classroom_id?: string; class_date: string; status: string }[];
    cancelledSessions?: { id?: string; classroom_id?: string; date: string; session_date?: string; reason?: string }[];
    payments?: { payment_date: string; amount?: number; status?: string; classes_added?: number }[];
    today?: Date;
    attendanceScopeStartDate?: string;
}

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPrettyDate(d: Date): string {
    const day = String(d.getDate()).padStart(2, '0');
    const mon = MONTH_SHORT_NAMES[d.getMonth()];
    const yr = d.getFullYear();
    return `${day} ${mon} ${yr}`;
}

/**
 * Authoritative, server-side class-credit and financial standing engine.
 * Rule: Payments are the ONLY source of credits (+4 standard).
 * Consumption: Present (-1), Late (-1), Absent (-1).
 * Excused (0), Makeup (1). Net for excused + makeup pair = 1.
 * Balance = totalPurchased - totalConsumed.
 * Balance > 0 -> GOOD_STANDING (canJoinLiveClass = true)
 * Balance = 0 -> FEE_DUE (canJoinLiveClass = true, NOT blocked, operational status ACTIVE)
 * Balance < 0 -> PAYMENT_OVERDUE (canJoinLiveClass = false)
 */
export function calculateAuthoritativeFeeStatus(input: {
    studentId: string;
    student?: {
        id?: string;
        fees_amount?: number | null;
        fees_basis?: string | null;
        fees_classes_paid?: number | null;
        fees_collection_date?: number | null;
        join_date?: string | Date | null;
        status?: string | null;
    };
    payments?: { payment_date: string; amount?: number; classes_added?: number; status?: string }[];
    attendance?: { id?: string; student_id?: string; classroom_id?: string; date?: string; session_date?: string; status: string; on_behalf_of_date?: string | null; classroom_name?: string }[];
    overrides?: { id?: string; student_id?: string; target_classroom_id?: string; override_date: string; missed_session_date?: string | null; reason?: string | null }[];
    leaveRequests?: { id?: string; student_id?: string; classroom_id?: string; class_date: string; status: string }[];
    today?: Date;
    attendanceScopeStartDate?: string;
}): AuthoritativeFeeStatus {
    const {
        studentId,
        student,
        payments = [],
        attendance = [],
        overrides = [],
        leaveRequests = []
    } = input;

    // 1. Total Purchased Credits from actual approved payments
    const approvedPayments = payments
        .filter(p => !p.status || p.status === 'approved')
        .sort((a, b) => a.payment_date.localeCompare(b.payment_date));

    let totalPurchasedCredits = 0;
    let lastPaymentDate: string | undefined;
    let lastPaymentAmount: number | undefined;

    for (const p of approvedPayments) {
        const credits = (typeof p.classes_added === 'number' && p.classes_added > 0)
            ? p.classes_added
            : (p.amount && p.amount > 0 && student?.fees_amount
                ? calculateClassesAdded(p.amount, student.fees_amount, student.fees_basis || 'monthly')
                : 4);
        totalPurchasedCredits += credits;
        lastPaymentDate = p.payment_date;
        lastPaymentAmount = p.amount;
    }

    // 2. Attendance & Makeup Reconciliation
    const studentAtt = attendance.filter(a => !a.student_id || a.student_id === studentId);
    const studentLvs = leaveRequests.filter(l => (!l.student_id || l.student_id === studentId) && l.status === 'approved');
    const studentOvr = overrides.filter(o => !o.student_id || o.student_id === studentId);

    const approvedLeaveDates = new Set(
        studentLvs.map(l => (l.class_date || '').split('T')[0])
    );

    // Identify makeup sessions linked to missed/excused dates
    const overrideByDate = new Map<string, typeof studentOvr[0]>();
    for (const ov of studentOvr) {
        const oDate = (ov.override_date || '').split('T')[0];
        overrideByDate.set(oDate, ov);
    }

    let totalConsumedCredits = 0;
    const consumedSlots = new Set<string>();

    for (const att of studentAtt) {
        const physicalDate = (att.date || att.session_date || '').split('T')[0];
        const onBehalfOf = att.on_behalf_of_date ? att.on_behalf_of_date.split('T')[0] : null;
        const status = (att.status || '').toLowerCase().trim();

        // Excused absences (or approved leaves) consume 0 credits
        if (status === 'excused' || approvedLeaveDates.has(physicalDate)) {
            continue;
        }

        // Attendance statuses that consume credit: present, late, absent
        if (status === 'present' || status === 'late' || status === 'absent') {
            const ov = overrideByDate.get(physicalDate);
            let missedDate = ov?.missed_session_date;
            if (!missedDate && ov?.reason) {
                const match = ov.reason.match(/\[MissedDate:([^\]]+)\]/);
                if (match) missedDate = match[1];
            }

            const effectiveDate = onBehalfOf || missedDate || physicalDate;

            // If an evaluation date (today) is provided, classes taken on behalf of a future date do not consume until that target date or today arrives
            if (input.today) {
                const todayStr = formatDateToYYYYMMDD(input.today);
                if (effectiveDate > todayStr) {
                    continue;
                }
            }

            if (!consumedSlots.has(effectiveDate)) {
                consumedSlots.add(effectiveDate);
                totalConsumedCredits++;
            }
        }
    }

    // 3. Authoritative Balance
    const effectiveBalance = totalPurchasedCredits - totalConsumedCredits;

    // 4. Financial State
    let financialState: FinancialState = 'GOOD_STANDING';
    if (effectiveBalance === 0) {
        financialState = 'FEE_DUE';
    } else if (effectiveBalance < 0) {
        financialState = 'PAYMENT_OVERDUE';
    }

    // 5. Live Class Access: Allowed at balance >= 0; Restricted ONLY at balance < 0
    const canJoinLiveClass = effectiveBalance >= 0;

    // 6. Reconciliation Discrepancy & Scope Symmetry Detection
    const stored = typeof student?.fees_classes_paid === 'number' ? student.fees_classes_paid : undefined;
    // For per-class students without payment records, stored fees_classes_paid is their baseline entitlement
    const isPerClassWithoutPayments = student?.fees_basis === 'class' && approvedPayments.length === 0;

    // Invariant: Enforce symmetrical data scope. If an attendance window start is declared,
    // ensure historical payments do not precede that window without attendance history.
    let hasScopeAsymmetry = false;
    let scopeAsymmetryReason: string | undefined;
    if (input.attendanceScopeStartDate && approvedPayments.length > 0) {
        const earliestPaymentDate = approvedPayments[0].payment_date;
        if (earliestPaymentDate < input.attendanceScopeStartDate) {
            hasScopeAsymmetry = true;
            scopeAsymmetryReason = `Asymmetric ledger scope: earliest payment (${earliestPaymentDate}) precedes attendance window start (${input.attendanceScopeStartDate})`;
        }
    }

    const needsReconciliation = (!isPerClassWithoutPayments && stored !== undefined && stored !== effectiveBalance) || hasScopeAsymmetry;
    const reconciliationReason = hasScopeAsymmetry
        ? scopeAsymmetryReason
        : needsReconciliation
        ? `Stored balance (${stored}) differs from authoritative calculated balance (${effectiveBalance})`
        : undefined;

    return {
        studentId,
        totalPurchasedCredits,
        totalConsumedCredits,
        effectiveBalance,
        financialState,
        canJoinLiveClass,
        lastPaymentDate,
        lastPaymentAmount,
        needsReconciliation,
        reconciliationReason
    };
}

/**
 * Shared, authoritative internal engine that evaluates all cycle sessions,
 * reconcile makeups/leaves/overrides, and compute both high-level metrics and
 * the itemized session ledger from a SINGLE evaluation source.
 */
export function evaluateStudentFeeCycle(
    input: StudentCycleCalculationInput
): FeeCycleLedgerReport {
    const {
        student,
        classrooms = [],
        batchSchedules = [],
        attendance = [],
        overrides = [],
        leaveRequests = [],
        payments = [],
        cancelledSessions = [],
        today = new Date()
    } = input;

    const studentId = student.id;
    const feesBasis = (student.fees_basis === 'class' ? 'class' : 'monthly') as 'monthly' | 'class';
    const todayStr = formatDateToYYYYMMDD(today);

    // Run authoritative fee calculation
    const authStatus = calculateAuthoritativeFeeStatus({
        studentId,
        student,
        payments,
        attendance,
        overrides,
        leaveRequests,
        today,
        attendanceScopeStartDate: input.attendanceScopeStartDate
    });

    // 1. Handling per-class students
    if (feesBasis === 'class') {
        const totalPurchased = authStatus.totalPurchasedCredits > 0
            ? authStatus.totalPurchasedCredits
            : (typeof student.fees_classes_paid === 'number' ? student.fees_classes_paid : 0);
        const effectiveBal = authStatus.totalPurchasedCredits > 0
            ? authStatus.effectiveBalance
            : (typeof student.fees_classes_paid === 'number' ? student.fees_classes_paid : 0);
        const available = Math.max(0, effectiveBal);

        const metrics: StudentFeeCycleMetrics = {
            studentId,
            feesBasis: 'class',
            basis: 'class',
            cycleStart: '',
            nextDueDate: '',
            formattedDueDate: 'Per-Class Prepaid',
            entitledClasses: totalPurchased,
            creditsRemaining: effectiveBal,
            effectiveBalance: effectiveBal,
            financialState: effectiveBal > 0 ? 'GOOD_STANDING' : (effectiveBal === 0 ? 'FEE_DUE' : 'PAYMENT_OVERDUE'),
            canJoinLiveClass: effectiveBal >= 0,
            needsReconciliation: authStatus.needsReconciliation,
            reconciliationReason: authStatus.reconciliationReason,
            classesAvailable: available,
            regularAttended: 0,
            unexcusedMissed: 0,
            excusedMissed: 0,
            regularFuture: 0,
            unresolvedSessions: 0,
            cancelledSessions: 0,
            makeupsPending: 0,
            makeupsScheduled: 0,
            makeupsCompleted: 0,
            makeupsExpired: 0,
            validOutstandingMakeups: 0,
            statusLabel: `${available} Prepaid Class${available === 1 ? '' : 'es'} Available`,
            badgeVariant: available > 0 ? 'good' : 'warning'
        };

        return {
            studentId,
            feesBasis: 'class',
            cycleStart: '',
            nextDueDate: '',
            formattedDueDate: 'Per-Class Prepaid',
            daysRemaining: 0,
            metrics,
            sessions: [],
            diagnostics: [],
            summary: {
                entitledClasses: totalPurchased,
                consumedClasses: authStatus.totalConsumedCredits,
                creditsRemaining: effectiveBal,
                effectiveBalance: effectiveBal,
                financialState: metrics.financialState,
                canJoinLiveClass: metrics.canJoinLiveClass,
                needsReconciliation: authStatus.needsReconciliation,
                operationalOpportunities: available,
                unresolvedSessions: 0,
                classesAvailable: available,
                hasDiscrepancy: authStatus.needsReconciliation || false
            }
        };
    }

    const effectiveResumeDate = input.resumeDate 
        || (student as any).resume_date 
        || (student as any).notes?.match(/\[Resumed\s+([0-9]{4}-[0-9]{2}-[0-9]{2})/)?.[1]
        || null;
    const effectivePauseDate = input.pauseEffectiveDate 
        || (student as any).pause_effective_date 
        || (student as any).notes?.match(/\[Paused\s+([0-9]{4}-[0-9]{2}-[0-9]{2})/)?.[1]
        || null;

    // 2. Derive half-open billing cycle [cycleStart <= date < nextDueDate)
    const cycle = getStudentBillingCycle(
        student.fees_collection_date,
        payments,
        today,
        student.join_date,
        student.status,
        effectivePauseDate,
        effectiveResumeDate
    );

    const { cycleStart, nextDueDate, formattedDueDate, daysRemaining } = cycle;

    // Monthly entitlement from actual cycle payment, or 0 if unpaid (never manufacture fictitious 4 credits)
    let entitledClasses = 0;
    if (cycle.allocatedPayment && typeof cycle.allocatedPayment.classes_added === 'number' && cycle.allocatedPayment.classes_added > 0) {
        entitledClasses = cycle.allocatedPayment.classes_added;
    } else if (cycle.allocatedPayment) {
        entitledClasses = 4;
    } else {
        const cyclePayments = payments.filter(
            p => (!p.status || p.status === 'approved') && p.payment_date >= cycleStart && p.payment_date < nextDueDate
        );
        if (cyclePayments.length > 0) {
            entitledClasses = typeof cyclePayments[0].classes_added === 'number' && cyclePayments[0].classes_added > 0
                ? cyclePayments[0].classes_added
                : 4;
        }
    }

    // Classroom lookups
    const classroomMap = new Map<string, string>();
    const classroomJoinedAtMap = new Map<string, string>();
    classrooms.forEach(c => {
        if (c.id) {
            classroomMap.set(c.id, c.name || 'Regular Batch');
            if (c.joined_at) {
                classroomJoinedAtMap.set(c.id, String(c.joined_at).split('T')[0]);
            }
        }
    });

    // Populate classroom names from attendance if available
    attendance.forEach(a => {
        if (a.classroom_id && a.classroom_name && !classroomMap.has(a.classroom_id)) {
            classroomMap.set(a.classroom_id, a.classroom_name);
        }
    });

    const classroomIds = new Set(classrooms.map(c => c.id));

    // Batch schedules mapping
    const scheduledDows = new Set<number>();
    const scheduleByDow = new Map<number, { classroom_id: string; start_time?: string; end_time?: string }>();
    batchSchedules.forEach(bs => {
        if (classroomIds.has(bs.classroom_id) && typeof bs.day_of_week === 'number') {
            scheduledDows.add(bs.day_of_week);
            if (!scheduleByDow.has(bs.day_of_week)) {
                scheduleByDow.set(bs.day_of_week, bs);
            }
        }
    });

    // Student attendance records
    const normalizedAttendance = attendance
        .filter(a => !a.student_id || a.student_id === studentId)
        .map(a => {
            const physicalDate = (a.date || a.session_date || '').split('T')[0];
            const onBehalfOf = a.on_behalf_of_date ? a.on_behalf_of_date.split('T')[0] : null;
            const effectiveDate = onBehalfOf || physicalDate;
            return {
                ...a,
                student_id: studentId,
                date: physicalDate,
                on_behalf_of_date: onBehalfOf,
                effectiveDate
            };
        });

    // Overrides for this student
    const studentOverrides = overrides.filter(o => !o.student_id || o.student_id === studentId);

    // Check which attendance records are makeups vs regular
    const isMakeupAttendance = (att: { date: string; classroom_id: string }) => {
        return studentOverrides.some(
            o => o.override_date === att.date && o.target_classroom_id === att.classroom_id
        );
    };

    let regularAttended = 0;
    let unexcusedMissed = 0;
    let excusedMissed = 0;

    // Map of effectiveDate -> attendance record that satisfies this scheduled date
    const attendanceByEffectiveDate = new Map<string, typeof normalizedAttendance[0]>();
    // Map of physicalDate -> attendance record that was physically marked on this date
    const attendanceByPhysicalDate = new Map<string, typeof normalizedAttendance[0]>();

    normalizedAttendance.forEach(a => {
        if (isMakeupAttendance(a)) {
            // makeup attendance handled separately in makeup reconciliation
            return;
        }
        attendanceByPhysicalDate.set(a.date, a);
        attendanceByEffectiveDate.set(a.effectiveDate, a);
    });

    // Approved leaves in cycle
    const approvedLeavesInCycle = leaveRequests.filter(
        l => (!l.student_id || l.student_id === studentId) && l.status === 'approved' && l.class_date >= cycleStart && l.class_date < nextDueDate
    );
    const approvedLeaveDates = new Set(approvedLeavesInCycle.map(l => l.class_date));

    // Cancelled sessions set
    const cancelledDates = new Set(
        cancelledSessions
            .filter(cs => !cs.classroom_id || classroomIds.has(cs.classroom_id))
            .map(cs => cs.date)
    );

    // 3. Iterate all calendar dates in [cycleStart, nextDueDate) to construct session ledger items
    const sessions: FeeCycleSessionItem[] = [];
    const diagnostics: FeeCycleDiagnostic[] = [];

    let regularFuture = 0;
    let unresolvedSessions = 0;
    let cancelledCount = 0;

    const [startYear, startMonth, startDay] = cycleStart.split('-').map(Number);
    const [endYear, endMonth, endDay] = nextDueDate.split('-').map(Number);

    const startDate = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(endYear, endMonth - 1, endDay);

    const iterDate = new Date(startDate);
    while (iterDate.getTime() < endDate.getTime()) {
        const iterDow = iterDate.getDay();
        const iterDateStr = formatDateToYYYYMMDD(iterDate);

        // Determine if there is an active recurring schedule for this day of week on this specific calendar date
        let isScheduledDay = false;
        let sched = scheduleByDow.get(iterDow);
        if (sched && scheduledDows.has(iterDow)) {
            const classJoinedAt = classroomJoinedAtMap.get(sched.classroom_id);
            // If the student joined this classroom on a specific date, only expect schedule on/after joined_at!
            if (!classJoinedAt || iterDateStr >= classJoinedAt) {
                isScheduledDay = true;
            }
        }

        const satisfyingAtt = attendanceByEffectiveDate.get(iterDateStr);
        const physicalAtt = attendanceByPhysicalDate.get(iterDateStr);
        const isCancelled = cancelledDates.has(iterDateStr);
        const hasApprovedLeave = approvedLeaveDates.has(iterDateStr);

        const shouldProcessSession =
            isScheduledDay ||
            Boolean(satisfyingAtt) ||
            Boolean(physicalAtt && physicalAtt.on_behalf_of_date && physicalAtt.on_behalf_of_date !== iterDateStr) ||
            hasApprovedLeave ||
            isCancelled;

        if (shouldProcessSession) {
            const classId = satisfyingAtt?.classroom_id || physicalAtt?.classroom_id || sched?.classroom_id || (classrooms[0]?.id ?? '');
            const className = (satisfyingAtt as any)?.classroom_name || (physicalAtt as any)?.classroom_name || classroomMap.get(classId) || classrooms[0]?.name || 'Batch Classroom';
            const timeSlot = sched?.start_time
                ? `${sched.start_time.slice(0, 5)} - ${sched.end_time?.slice(0, 5) || ''}`
                : undefined;

            const displayDate = formatPrettyDate(iterDate);
            const dayName = DOW_NAMES[iterDow];

            if (isCancelled) {
                cancelledCount++;
                sessions.push({
                    id: `reg-${iterDateStr}-${classId}`,
                    date: iterDateStr,
                    displayDate,
                    dayName,
                    timeSlot,
                    classroomId: classId,
                    classroomName: className,
                    sessionType: 'regular',
                    status: 'cancelled',
                    statusLabel: '🚫 Class Cancelled',
                    creditImpact: 'not_consumed',
                    creditImpactLabel: '0 classes consumed (cancelled)',
                    isDiscrepancy: false,
                    notes: 'Session cancelled by academy/teacher.'
                });
            } else if (satisfyingAtt) {
                // Scheduled class satisfied by an attendance record (either on same date or on-behalf-of)
                const isDifferentDate = satisfyingAtt.date !== iterDateStr;
                const isLate = satisfyingAtt.status === 'late';
                const [pYr, pMo, pDa] = satisfyingAtt.date.split('-').map(Number);
                const physDisplay = formatPrettyDate(new Date(pYr, pMo - 1, pDa));

                if (satisfyingAtt.status === 'present' || satisfyingAtt.status === 'late') {
                    regularAttended++;
                    sessions.push({
                        id: `reg-${iterDateStr}-${classId}`,
                        date: iterDateStr,
                        actualDate: satisfyingAtt.date,
                        onBehalfOfDate: isDifferentDate ? iterDateStr : undefined,
                        displayDate,
                        dayName,
                        timeSlot,
                        classroomId: classId,
                        classroomName: className,
                        sessionType: 'regular',
                        status: 'attended',
                        statusLabel: isDifferentDate
                            ? `✅ Attended (Satisfied by ${physDisplay} class)`
                            : isLate ? '🕒 Attended (Late)' : '✅ Attended',
                        creditImpact: 'consumed',
                        creditImpactLabel: '1 class consumed',
                        isDiscrepancy: false,
                        actionUrl: `/teacher-dashboard/attendance?date=${satisfyingAtt.date}&classId=${classId}`,
                        actionLabel: 'View Attendance →',
                        notes: isDifferentDate
                            ? `Satisfied by class physically taken on ${physDisplay} on behalf of this scheduled date.`
                            : isLate ? 'Marked late (counts as attended).' : 'Marked present.'
                    });
                } else if (satisfyingAtt.status === 'absent') {
                    unexcusedMissed++;
                    sessions.push({
                        id: `reg-${iterDateStr}-${classId}`,
                        date: iterDateStr,
                        actualDate: satisfyingAtt.date,
                        onBehalfOfDate: isDifferentDate ? iterDateStr : undefined,
                        displayDate,
                        dayName,
                        timeSlot,
                        classroomId: classId,
                        classroomName: className,
                        sessionType: 'regular',
                        status: 'absent',
                        statusLabel: isDifferentDate
                            ? `❌ Absent (Satisfied by ${physDisplay} class)`
                            : '❌ Absent',
                        creditImpact: 'consumed',
                        creditImpactLabel: '1 class consumed (unexcused)',
                        isDiscrepancy: false,
                        actionUrl: `/teacher-dashboard/attendance?date=${satisfyingAtt.date}&classId=${classId}`,
                        actionLabel: 'Review Attendance →',
                        notes: isDifferentDate
                            ? `Marked absent on class physically taken on ${physDisplay} on behalf of this scheduled date.`
                            : 'Unexcused absence. Consumes 1 class credit per policy.'
                    });
                } else if (satisfyingAtt.status === 'excused') {
                    excusedMissed++;
                    sessions.push({
                        id: `reg-${iterDateStr}-${classId}`,
                        date: iterDateStr,
                        actualDate: satisfyingAtt.date,
                        onBehalfOfDate: isDifferentDate ? iterDateStr : undefined,
                        displayDate,
                        dayName,
                        timeSlot,
                        classroomId: classId,
                        classroomName: className,
                        sessionType: 'regular',
                        status: 'excused',
                        statusLabel: isDifferentDate
                            ? `🟠 Excused (Satisfied by ${physDisplay} class)`
                            : '🟠 Excused',
                        creditImpact: 'not_consumed',
                        creditImpactLabel: '0 classes consumed (makeup eligible)',
                        isDiscrepancy: false,
                        actionUrl: `/teacher-dashboard/attendance?date=${satisfyingAtt.date}&classId=${classId}`,
                        actionLabel: 'View Record →',
                        notes: isDifferentDate
                            ? `Marked excused on class physically taken on ${physDisplay} on behalf of this scheduled date.`
                            : 'Absence marked as excused. Grants makeup eligibility.'
                    });
                }
            } else if (physicalAtt && physicalAtt.on_behalf_of_date && physicalAtt.on_behalf_of_date !== iterDateStr) {
                // Physical attendance happened on this day, but taken on behalf of another scheduled class!
                const [bYr, bMo, bDa] = physicalAtt.on_behalf_of_date.split('-').map(Number);
                const behalfDisplay = formatPrettyDate(new Date(bYr, bMo - 1, bDa));
                sessions.push({
                    id: `reg-${iterDateStr}-${classId}`,
                    date: iterDateStr,
                    actualDate: iterDateStr,
                    onBehalfOfDate: physicalAtt.on_behalf_of_date,
                    displayDate,
                    dayName,
                    timeSlot,
                    classroomId: classId,
                    classroomName: className,
                    sessionType: 'regular',
                    status: 'attended',
                    statusLabel: `✅ Attended (on behalf of ${behalfDisplay})`,
                    creditImpact: 'not_consumed',
                    creditImpactLabel: `0 classes consumed in current cycle (satisfies ${behalfDisplay})`,
                    isDiscrepancy: false,
                    actionUrl: `/teacher-dashboard/attendance?date=${iterDateStr}&classId=${classId}`,
                    actionLabel: 'View Attendance →',
                    notes: `Class physically taken on ${displayDate} on behalf of scheduled class on ${behalfDisplay}.`
                });
            } else {
                // No attendance record
                if (hasApprovedLeave) {
                    excusedMissed++;
                    sessions.push({
                        id: `reg-${iterDateStr}-${classId}`,
                        date: iterDateStr,
                        displayDate,
                        dayName,
                        timeSlot,
                        classroomId: classId,
                        classroomName: className,
                        sessionType: 'regular',
                        status: 'excused',
                        statusLabel: '🟠 Excused (Leave Approved)',
                        creditImpact: 'not_consumed',
                        creditImpactLabel: '0 classes consumed (makeup eligible)',
                        isDiscrepancy: false,
                        actionUrl: `/teacher-dashboard/attendance?mode=leaves`,
                        actionLabel: 'View Leave Request →',
                        notes: 'Approved leave request on record. Grants makeup eligibility.'
                    });
                } else if (iterDateStr > todayStr) {
                    regularFuture++;
                    sessions.push({
                        id: `reg-${iterDateStr}-${classId}`,
                        date: iterDateStr,
                        displayDate,
                        dayName,
                        timeSlot,
                        classroomId: classId,
                        classroomName: className,
                        sessionType: 'regular',
                        status: 'upcoming',
                        statusLabel: '🕒 Upcoming',
                        creditImpact: 'pending',
                        creditImpactLabel: 'Future scheduled class',
                        isDiscrepancy: false,
                        notes: 'Future scheduled class in current billing cycle.'
                    });
                } else if (iterDateStr === todayStr) {
                    regularFuture++;
                    sessions.push({
                        id: `reg-${iterDateStr}-${classId}`,
                        date: iterDateStr,
                        displayDate,
                        dayName,
                        timeSlot,
                        classroomId: classId,
                        classroomName: className,
                        sessionType: 'regular',
                        status: 'upcoming',
                        statusLabel: '🕒 Today (Scheduled)',
                        creditImpact: 'pending',
                        creditImpactLabel: 'Awaiting today\'s attendance',
                        isDiscrepancy: false,
                        actionUrl: `/teacher-dashboard/attendance?date=${iterDateStr}&classId=${classId}&studentId=${studentId}`,
                        actionLabel: 'Mark Attendance →',
                        notes: 'Class scheduled today. Pending attendance marking.'
                    });
                } else {
                    // Past session with NO attendance and NO cancellation -> Unresolved!
                    unresolvedSessions++;
                    sessions.push({
                        id: `reg-${iterDateStr}-${classId}`,
                        date: iterDateStr,
                        displayDate,
                        dayName,
                        timeSlot,
                        classroomId: classId,
                        classroomName: className,
                        sessionType: 'regular',
                        status: 'unresolved',
                        statusLabel: '⚠️ Attendance Missing',
                        creditImpact: 'pending',
                        creditImpactLabel: 'Awaiting attendance review',
                        isDiscrepancy: true,
                        discrepancyReason: `Scheduled class on ${displayDate} has passed with no attendance record marked.`,
                        actionUrl: `/teacher-dashboard/attendance?date=${iterDateStr}&classId=${classId}&studentId=${studentId}`,
                        actionLabel: 'Review Attendance →',
                        notes: 'Past scheduled date has no attendance row or cancellation record in database.'
                    });

                    diagnostics.push({
                        type: 'unresolved_session',
                        severity: 'warning',
                        title: `Attendance Missing: ${displayDate} (${dayName})`,
                        detail: `A class was scheduled in ${className}, but no attendance (present/absent/excused) was recorded.`,
                        affectedDate: iterDateStr,
                        affectedClassroomId: classId,
                        actionUrl: `/teacher-dashboard/attendance?date=${iterDateStr}&classId=${classId}&studentId=${studentId}`,
                        actionLabel: 'Review Attendance →'
                    });
                }
            }
        }
        iterDate.setDate(iterDate.getDate() + 1);
    }

    // 4. Makeup Reconciliation: Link each excused date to overrides and attendance
    const excusedDates = new Set<string>();
    sessions.forEach(s => {
        if (s.status === 'excused' && s.sessionType === 'regular') {
            excusedDates.add(s.date);
        }
    });
    approvedLeavesInCycle.forEach(l => {
        excusedDates.add(l.class_date);
    });

    let makeupsPending = 0;
    let makeupsScheduled = 0;
    let makeupsCompleted = 0;
    let makeupsExpired = 0;

    excusedDates.forEach(missedDate => {
        const override = studentOverrides.find(o => {
            if (o.missed_session_date && o.missed_session_date === missedDate) return true;
            const r = o.reason || '';
            return r.includes(`[MissedDate:${missedDate}]`) || r.includes(missedDate);
        });

        const [mYr, mMo, mDa] = missedDate.split('-').map(Number);
        const missedDateFormatted = formatPrettyDate(new Date(mYr, mMo - 1, mDa));

        if (!override) {
            // No override created yet
            if (todayStr < nextDueDate) {
                makeupsPending++;
                sessions.push({
                    id: `makeup-pending-${missedDate}`,
                    date: missedDate,
                    displayDate: missedDateFormatted,
                    dayName: 'Makeup Slot',
                    classroomId: classrooms[0]?.id || '',
                    classroomName: 'Pending Booking',
                    sessionType: 'makeup',
                    status: 'makeup_pending',
                    statusLabel: '🟡 Makeup Pending',
                    creditImpact: 'not_consumed',
                    creditImpactLabel: '0 classes consumed (makeup pending)',
                    isDiscrepancy: false,
                    notes: `Eligible for a makeup session for excused absence on ${missedDateFormatted}.`
                });
            } else {
                makeupsExpired++;
            }
        } else {
            // An override exists
            const overrideDate = override.override_date;
            const [oYr, oMo, oDa] = overrideDate.split('-').map(Number);
            const overrideDateFormatted = formatPrettyDate(new Date(oYr, oMo - 1, oDa));
            const targetClassId = override.target_classroom_id;
            const targetClassName = classroomMap.get(targetClassId) || 'Makeup Batch';

            const makeupAtt = normalizedAttendance.find(
                a => a.date === overrideDate && a.classroom_id === targetClassId
            );

            if (makeupAtt && (makeupAtt.status === 'present' || makeupAtt.status === 'late')) {
                makeupsCompleted++;
                sessions.push({
                    id: `makeup-done-${override.id || overrideDate}`,
                    date: overrideDate,
                    displayDate: overrideDateFormatted,
                    dayName: 'Makeup Batch',
                    classroomId: targetClassId,
                    classroomName: targetClassName,
                    sessionType: 'makeup',
                    status: 'makeup_attended',
                    statusLabel: '🔵 Makeup Attended',
                    creditImpact: 'consumed',
                    creditImpactLabel: '1 class consumed (makeup attended)',
                    isDiscrepancy: false,
                    actionUrl: `/teacher-dashboard/attendance?date=${overrideDate}&classId=${targetClassId}`,
                    actionLabel: 'View Attendance →',
                    notes: `Completed makeup for excused absence on ${missedDateFormatted}.`
                });
            } else if (overrideDate >= todayStr) {
                makeupsScheduled++;
                sessions.push({
                    id: `makeup-sched-${override.id || overrideDate}`,
                    date: overrideDate,
                    displayDate: overrideDateFormatted,
                    dayName: 'Makeup Batch',
                    classroomId: targetClassId,
                    classroomName: targetClassName,
                    sessionType: 'makeup',
                    status: 'makeup_scheduled',
                    statusLabel: '🟣 Makeup Scheduled',
                    creditImpact: 'pending',
                    creditImpactLabel: 'Future makeup session',
                    isDiscrepancy: false,
                    notes: `Scheduled makeup for excused absence on ${missedDateFormatted}.`
                });
            } else {
                // Past override date without attendance or absent
                if (makeupAtt && makeupAtt.status === 'absent') {
                    // Attempted makeup but missed without notice -> forfeited
                    sessions.push({
                        id: `makeup-forfeit-${override.id || overrideDate}`,
                        date: overrideDate,
                        displayDate: overrideDateFormatted,
                        dayName: 'Makeup Batch',
                        classroomId: targetClassId,
                        classroomName: targetClassName,
                        sessionType: 'makeup',
                        status: 'absent',
                        statusLabel: '❌ Makeup Missed',
                        creditImpact: 'consumed',
                        creditImpactLabel: '1 class consumed (forfeited makeup)',
                        isDiscrepancy: false,
                        actionUrl: `/teacher-dashboard/attendance?date=${overrideDate}&classId=${targetClassId}`,
                        actionLabel: 'Review Attendance →',
                        notes: `Student was absent from scheduled makeup session for ${missedDateFormatted}. Credit forfeited.`
                    });
                } else {
                    // Unresolved makeup session
                    unresolvedSessions++;
                    sessions.push({
                        id: `makeup-unresolved-${override.id || overrideDate}`,
                        date: overrideDate,
                        displayDate: overrideDateFormatted,
                        dayName: 'Makeup Batch',
                        classroomId: targetClassId,
                        classroomName: targetClassName,
                        sessionType: 'makeup',
                        status: 'makeup_unresolved',
                        statusLabel: '⚠️ Makeup Attendance Missing',
                        creditImpact: 'pending',
                        creditImpactLabel: 'Awaiting makeup attendance review',
                        isDiscrepancy: true,
                        discrepancyReason: `Scheduled makeup on ${overrideDateFormatted} has passed without an attendance mark.`,
                        actionUrl: `/teacher-dashboard/attendance?date=${overrideDate}&classId=${targetClassId}&studentId=${studentId}`,
                        actionLabel: 'Review Makeup Attendance →',
                        notes: `Scheduled makeup for ${missedDateFormatted} occurred in the past, but attendance was never marked.`
                    });

                    diagnostics.push({
                        type: 'unresolved_makeup',
                        severity: 'warning',
                        title: `Makeup Attendance Missing: ${overrideDateFormatted}`,
                        detail: `A makeup was booked in ${targetClassName}, but attendance was not marked.`,
                        affectedDate: overrideDate,
                        affectedClassroomId: targetClassId,
                        actionUrl: `/teacher-dashboard/attendance?date=${overrideDate}&classId=${targetClassId}&studentId=${studentId}`,
                        actionLabel: 'Review Makeup Attendance →'
                    });
                }
            }
        }
    });

    // Sort sessions chronologically
    sessions.sort((a, b) => a.date.localeCompare(b.date));

    // 5. Authoritative Credit & Balance Integration
    // Financial creditsRemaining comes strictly from the authoritative ledger balance
    const creditsRemaining = authStatus.effectiveBalance;
    const validOutstandingMakeupEntitlements = makeupsPending + makeupsScheduled;
    const operationalOpportunities = regularFuture + validOutstandingMakeupEntitlements;
    // Operational availability is capped by operational opportunities when there are unresolved sessions,
    // otherwise reflects positive balance (calendar boundaries do not zero out purchased credits)
    const classesAvailable = unresolvedSessions > 0
        ? Math.min(creditsRemaining, operationalOpportunities)
        : Math.max(0, creditsRemaining);
    const consumedClasses = regularAttended + unexcusedMissed + makeupsCompleted;

    const hasDiscrepancy = (authStatus.needsReconciliation || false) || (creditsRemaining > 0 && unresolvedSessions > 0);

    if (authStatus.needsReconciliation && authStatus.reconciliationReason) {
        diagnostics.unshift({
            type: 'calculation_mismatch',
            severity: 'danger',
            title: 'Reconciliation Needed',
            detail: authStatus.reconciliationReason
        });
    } else if (hasDiscrepancy && unresolvedSessions > 0) {
        diagnostics.unshift({
            type: 'calculation_mismatch',
            severity: 'warning',
            title: `${creditsRemaining} Credit Unresolved`,
            detail: `The student has ${creditsRemaining} unused financial credit(s), but operational available classes report 0 because ${unresolvedSessions} scheduled session(s) in the past have no attendance marked. Once marked or excused, the balance will reconcile.`
        });
    }

    // 6. Visual status label & badge variant
    const isPausedStudent = cycle.isPaused || (student.status || '').toLowerCase().trim() === 'inactive' || (student.status || '').toLowerCase().trim() === 'paused';
    let statusLabel = 'Good Standing';
    let badgeVariant: 'good' | 'warning' | 'danger' | 'neutral' = 'neutral';
    let alertType: 'unresolved' | 'due' | 'overdue' | undefined;

    if (isPausedStudent) {
        if (cycle.hasPrePauseDebt) {
            statusLabel = 'Learning Paused · Unpaid Pre-Pause Balance';
            badgeVariant = 'warning';
            alertType = 'due';
        } else {
            statusLabel = 'Learning Paused · Billing Paused';
            badgeVariant = 'neutral';
            alertType = undefined;
        }
    } else if (authStatus.needsReconciliation) {
        statusLabel = 'Reconciliation Needed';
        badgeVariant = 'danger';
        alertType = 'overdue';
    } else if (authStatus.financialState === 'PAYMENT_OVERDUE') {
        statusLabel = 'Payment Overdue';
        badgeVariant = 'danger';
        alertType = 'overdue';
    } else if (unresolvedSessions > 0) {
        statusLabel = `Attendance Review Needed (${unresolvedSessions} unresolved)`;
        badgeVariant = 'warning';
        alertType = 'unresolved';
    } else if (authStatus.financialState === 'FEE_DUE') {
        if (unexcusedMissed > 0 && regularAttended + unexcusedMissed >= entitledClasses) {
            statusLabel = 'Cycle Complete · Forfeited';
        } else {
            statusLabel = 'Cycle Complete / Fee Due';
        }
        badgeVariant = 'warning';
        alertType = 'due';
    } else {
        const parts: string[] = [];
        if (regularFuture > 0) {
            parts.push(`${regularFuture} Regular`);
        }
        if (makeupsPending > 0) {
            parts.push(`${makeupsPending} Makeup Pending`);
        }
        if (makeupsScheduled > 0) {
            parts.push(`${makeupsScheduled} Makeup Scheduled`);
        }
        statusLabel = parts.join(' · ') || (classesAvailable === 1 ? '1 Class Remaining' : `${classesAvailable} Classes Remaining`);
        badgeVariant = 'good';
    }

    const displayDueDate = creditsRemaining > 0
        ? `After ${creditsRemaining} ${creditsRemaining === 1 ? 'class' : 'classes'}`
        : (creditsRemaining === 0 ? 'Fee Due' : 'Payment Overdue');

    const metrics: StudentFeeCycleMetrics = {
        studentId,
        feesBasis: 'monthly',
        basis: 'monthly',
        cycleStart,
        nextDueDate,
        formattedDueDate: displayDueDate,
        entitledClasses: entitledClasses || authStatus.totalPurchasedCredits,
        creditsRemaining,
        effectiveBalance: authStatus.effectiveBalance,
        financialState: authStatus.financialState,
        canJoinLiveClass: authStatus.canJoinLiveClass,
        needsReconciliation: authStatus.needsReconciliation,
        reconciliationReason: authStatus.reconciliationReason,
        classesAvailable,
        regularAttended,
        unexcusedMissed,
        excusedMissed,
        regularFuture,
        unresolvedSessions,
        cancelledSessions: cancelledCount,
        makeupsPending,
        makeupsScheduled,
        makeupsCompleted,
        makeupsExpired,
        validOutstandingMakeups: validOutstandingMakeupEntitlements,
        statusLabel,
        badgeVariant,
        alertType,
        isPaid: cycle.isPaid,
        isLatePayment: cycle.isLatePayment,
        paymentStatus: cycle.feeStatus,
        allocatedPayment: cycle.allocatedPayment,
        unpaidCyclesCount: cycle.unpaidCyclesCount
    };

    return {
        studentId,
        feesBasis: 'monthly',
        cycleStart,
        nextDueDate,
        formattedDueDate: displayDueDate,
        daysRemaining: Math.max(0, creditsRemaining),
        isPaid: cycle.isPaid,
        isLatePayment: cycle.isLatePayment,
        paymentStatus: cycle.feeStatus,
        allocatedPayment: cycle.allocatedPayment,
        unpaidCyclesCount: cycle.unpaidCyclesCount,
        canJoinLiveClass: authStatus.canJoinLiveClass,
        metrics,
        sessions,
        diagnostics,
        summary: {
            entitledClasses: entitledClasses || authStatus.totalPurchasedCredits,
            consumedClasses,
            creditsRemaining,
            effectiveBalance: authStatus.effectiveBalance,
            financialState: authStatus.financialState,
            canJoinLiveClass: authStatus.canJoinLiveClass,
            needsReconciliation: authStatus.needsReconciliation,
            operationalOpportunities,
            unresolvedSessions,
            classesAvailable,
            hasDiscrepancy
        }
    };
}

/**
 * Authoritative function to calculate student fee cycle metrics with separation of values,
 * makeup-to-missed-date reconciliation, and entitlement capping.
 * Reuses the exact same evaluateStudentFeeCycle engine to avoid duplicated calculation logic.
 */
export function calculateStudentFeeCycleMetrics(
    input: StudentCycleCalculationInput
): StudentFeeCycleMetrics {
    return evaluateStudentFeeCycle(input).metrics;
}

/**
 * Authoritative function to retrieve the complete chronological Fee Cycle Class Ledger
 * and diagnostic report for a student, sharing the exact same evaluation source.
 */
export function getStudentFeeCycleLedger(
    input: StudentCycleCalculationInput
): FeeCycleLedgerReport {
    return evaluateStudentFeeCycle(input);
}

