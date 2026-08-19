// Shared utilities for student fee status and due date calculations.

export interface FeeStatusDetails {
    dueDate: Date;         // The active due date being tracked
    diffDays: number;       // Difference in days (dueDate - today)
    status: 'good' | 'upcoming' | 'due' | 'overdue';
    formattedDueDate: string; 
    hasPendingPayment?: boolean; // If they have submitted a payment that is awaiting approval
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
 * Calculates a student's monthly fee due date and payment status.
 */
export function getStudentFeeStatus(
    feesBasis: string | null | undefined,
    feesCollectionDay: number | null | undefined,
    payments: { payment_date: string, status?: string }[],
    today: Date = new Date(),
    joinDate?: string | Date | null
): FeeStatusDetails | null {
    if (feesBasis !== 'monthly') {
        return null;
    }

    // Determine collection day: if not explicitly set, derive from joinDate day, default to 1
    let collectionDay = Number(feesCollectionDay);
    if (!collectionDay || isNaN(collectionDay) || collectionDay < 1 || collectionDay > 31) {
        if (joinDate) {
            const jDate = new Date(joinDate);
            if (!isNaN(jDate.getTime())) {
                collectionDay = jDate.getDate();
            } else {
                collectionDay = 1;
            }
        } else {
            collectionDay = 1;
        }
    }

    // Check if there is any pending payment awaiting approval
    const hasPendingPayment = payments.some(p => p.status === 'pending_approval');

    // Only consider approved payments for actual standing
    const approvedPayments = payments.filter(p => !p.status || p.status === 'approved');

    // Standardize today to midnight for precise date-only calculations
    const todayZero = new Date(today);
    todayZero.setHours(0, 0, 0, 0);

    const year = todayZero.getFullYear();
    const month = todayZero.getMonth(); 

    const getClampedDate = (yr: number, mo: number, day: number) => {
        const date = new Date(yr, mo, day);
        if (date.getMonth() !== (mo + 12) % 12) {
            return new Date(yr, mo + 1, 0);
        }
        return date;
    };

    const prevDueDate = getClampedDate(year, month - 1, collectionDay);
    prevDueDate.setHours(0, 0, 0, 0);

    let currDueDate = getClampedDate(year, month, collectionDay);
    currDueDate.setHours(0, 0, 0, 0);

    let nextDueDate = getClampedDate(year, month + 1, collectionDay);
    nextDueDate.setHours(0, 0, 0, 0);

    // If joinDate is present and student joined in current or future month, clamp currDueDate to joining month's collection date
    if (joinDate) {
        const jDate = new Date(joinDate);
        jDate.setHours(0, 0, 0, 0);
        if (!isNaN(jDate.getTime()) && jDate.getTime() > currDueDate.getTime()) {
            const jYear = jDate.getFullYear();
            const jMonth = jDate.getMonth();
            currDueDate = getClampedDate(jYear, jMonth, collectionDay);
            if (currDueDate.getTime() < jDate.getTime()) {
                currDueDate = getClampedDate(jYear, jMonth + 1, collectionDay);
            }
            nextDueDate = getClampedDate(currDueDate.getFullYear(), currDueDate.getMonth() + 1, collectionDay);
        }
    }

    // Helper to find which due date is closest to the payment date
    const getClosestDueDate = (pDate: Date, cDay: number) => {
        const pYear = pDate.getFullYear();
        const pMonth = pDate.getMonth();
        
        const options = [
            getClampedDate(pYear, pMonth - 1, cDay),
            getClampedDate(pYear, pMonth, cDay),
            getClampedDate(pYear, pMonth + 1, cDay)
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
    };

    const hasPaidCurr = approvedPayments.some(p => {
        const pDate = new Date(p.payment_date);
        pDate.setHours(0, 0, 0, 0);
        const closestDue = getClosestDueDate(pDate, collectionDay);
        return closestDue.getTime() === currDueDate.getTime();
    });

    let activeDueDate: Date;
    if (hasPaidCurr) {
        activeDueDate = nextDueDate;
    } else {
        activeDueDate = currDueDate;
    }

    const diffTime = activeDueDate.getTime() - todayZero.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status: 'good' | 'upcoming' | 'due' | 'overdue';
    if (hasPaidCurr) {
        status = 'good';
    } else {
        if (diffDays < 0) {
            status = 'overdue';
        } else if (diffDays === 0) {
            status = 'due';
        } else if (diffDays <= 3) {
            status = 'upcoming';
        } else {
            status = 'good';
        }
    }

    const day = activeDueDate.getDate();
    const monthName = activeDueDate.toLocaleString('en-US', { month: 'short' });
    const formattedDueDate = `${day} ${monthName}`;

    return {
        dueDate: activeDueDate,
        diffDays,
        status,
        formattedDueDate,
        hasPendingPayment
    };
}
