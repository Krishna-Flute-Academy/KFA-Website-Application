// Shared utilities for student fee status and due date calculations.

export interface FeeStatusDetails {
    dueDate: Date;         // The active due date being tracked (e.g. 27 June or 27 July)
    diffDays: number;       // Difference in days (dueDate - today)
    status: 'good' | 'upcoming' | 'due' | 'overdue';
    formattedDueDate: string; // E.g. "27 June"
}

/**
 * Calculates a student's monthly fee due date and payment status.
 *
 * @param feesBasis 'monthly' or 'class'
 * @param feesCollectionDay Day of month (1 to 31)
 * @param payments List of payment records for the student
 * @param today Reference date for "today" (defaults to current system time)
 */
export function getStudentFeeStatus(
    feesBasis: string | null | undefined,
    feesCollectionDay: number | null | undefined,
    payments: { payment_date: string }[],
    today: Date = new Date()
): FeeStatusDetails | null {
    if (feesBasis !== 'monthly' || !feesCollectionDay) {
        return null;
    }

    // Standardize today to midnight for precise date-only calculations
    const todayZero = new Date(today);
    todayZero.setHours(0, 0, 0, 0);

    const year = todayZero.getFullYear();
    const month = todayZero.getMonth(); // 0-indexed: 0 = Jan, 11 = Dec

    // Helper to get a date safely clamped to the end of the month
    const getClampedDate = (yr: number, mo: number, day: number) => {
        const date = new Date(yr, mo, day);
        // If month shifted (e.g. Feb 30 -> Mar 2), clamp to the last day of target month
        if (date.getMonth() !== (mo + 12) % 12) {
            return new Date(yr, mo + 1, 0); // 0th day of next month is last day of current month
        }
        return date;
    };

    // Calculate billing cycle boundaries
    // 1. Previous month's due date
    const prevDueDate = getClampedDate(year, month - 1, feesCollectionDay);
    prevDueDate.setHours(0, 0, 0, 0);

    // 2. Current month's due date
    const currDueDate = getClampedDate(year, month, feesCollectionDay);
    currDueDate.setHours(0, 0, 0, 0);

    // 3. Next month's due date
    const nextDueDate = getClampedDate(year, month + 1, feesCollectionDay);
    nextDueDate.setHours(0, 0, 0, 0);

    // Determine if the student has paid for the current billing cycle (represented by currDueDate).
    // A payment is considered to cover the currDueDate cycle if it is made after the previous due date (prevDueDate).
    const hasPaidCurr = payments.some(p => {
        const pDate = new Date(p.payment_date);
        pDate.setHours(0, 0, 0, 0);
        return pDate > prevDueDate;
    });

    let activeDueDate: Date;
    if (hasPaidCurr) {
        // If they already paid for the current month's due date, the next due date to watch is nextDueDate
        activeDueDate = nextDueDate;
    } else {
        // Otherwise, they are still responsible for the current month's due date
        activeDueDate = currDueDate;
    }

    const diffTime = activeDueDate.getTime() - todayZero.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status: 'good' | 'upcoming' | 'due' | 'overdue';
    if (hasPaidCurr) {
        // They paid, so they are in good standing (their next due date is next month)
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
        formattedDueDate
    };
}
