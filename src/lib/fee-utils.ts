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
 * relative to the standard monthly fee (which covers 4 classes).
 */
export function calculateClassesAdded(amountPaid: number, monthlyFee: number): number {
    if (!monthlyFee || monthlyFee <= 0) return 0;
    const costPerClass = monthlyFee / 4;
    // e.g., 2500 monthly / 4 = 625 per class. 
    // If they pay 625, they get Math.floor(625/625) = 1 class.
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
    today: Date = new Date()
): FeeStatusDetails | null {
    if (feesBasis !== 'monthly' || !feesCollectionDay) {
        return null;
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

    const prevDueDate = getClampedDate(year, month - 1, feesCollectionDay);
    prevDueDate.setHours(0, 0, 0, 0);

    const currDueDate = getClampedDate(year, month, feesCollectionDay);
    currDueDate.setHours(0, 0, 0, 0);

    const nextDueDate = getClampedDate(year, month + 1, feesCollectionDay);
    nextDueDate.setHours(0, 0, 0, 0);

    const hasPaidCurr = approvedPayments.some(p => {
        const pDate = new Date(p.payment_date);
        pDate.setHours(0, 0, 0, 0);
        return pDate > prevDueDate;
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
    const monthName = activeDueDate.toLocaleString('en-US', { month: 'long' });
    const formattedDueDate = `${day} ${monthName}`;

    return {
        dueDate: activeDueDate,
        diffDays,
        status,
        formattedDueDate,
        hasPendingPayment
    };
}
