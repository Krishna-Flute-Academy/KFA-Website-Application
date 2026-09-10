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

    if (!feesCollectionDay && !joinDate) {
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
    formattedDueDate: string;    // e.g. "13 September"
    daysRemaining: number;
    feeStatus: 'good' | 'upcoming' | 'due' | 'overdue';
    hasPendingPayment: boolean;
}

/**
 * Derives the active half-open billing cycle [cycleStart, nextDueDate) for a student.
 */
export function getStudentBillingCycle(
    feesCollectionDay: number | null | undefined,
    payments: { payment_date: string; status?: string; classes_added?: number }[] = [],
    today: Date = new Date(),
    joinDate?: string | Date | null
): StudentBillingCycle {
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

    const todayZero = new Date(today);
    todayZero.setHours(0, 0, 0, 0);

    const year = todayZero.getFullYear();
    const month = todayZero.getMonth();

    const prevDueDate = getClampedMonthDate(year, month - 1, collectionDay);
    prevDueDate.setHours(0, 0, 0, 0);

    let currDueDate = getClampedMonthDate(year, month, collectionDay);
    currDueDate.setHours(0, 0, 0, 0);

    let nextDueDate = getClampedMonthDate(year, month + 1, collectionDay);
    nextDueDate.setHours(0, 0, 0, 0);

    // If joinDate is present and student joined after currDueDate, shift cycle
    if (joinDate) {
        const jDate = new Date(joinDate);
        jDate.setHours(0, 0, 0, 0);
        if (!isNaN(jDate.getTime()) && jDate.getTime() > currDueDate.getTime()) {
            const jYear = jDate.getFullYear();
            const jMonth = jDate.getMonth();
            currDueDate = getClampedMonthDate(jYear, jMonth, collectionDay);
            if (currDueDate.getTime() < jDate.getTime()) {
                currDueDate = getClampedMonthDate(jYear, jMonth + 1, collectionDay);
            }
            nextDueDate = getClampedMonthDate(currDueDate.getFullYear(), currDueDate.getMonth() + 1, collectionDay);
        }
    }

    const approvedPayments = payments.filter(p => !p.status || p.status === 'approved');

    const getClosestDueDate = (pDate: Date, cDay: number) => {
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
    };

    const hasPaidCurr = approvedPayments.some(p => {
        const pDate = new Date(p.payment_date);
        pDate.setHours(0, 0, 0, 0);
        const closestDue = getClosestDueDate(pDate, collectionDay);
        return closestDue.getTime() === currDueDate.getTime();
    });

    let activeCycleStart: Date;
    let activeDueDate: Date;

    if (hasPaidCurr) {
        activeCycleStart = currDueDate;
        activeDueDate = nextDueDate;
    } else {
        activeCycleStart = prevDueDate;
        activeDueDate = currDueDate;
    }

    // Clamp cycle start if student joined after activeCycleStart
    if (joinDate) {
        const jDate = new Date(joinDate);
        jDate.setHours(0, 0, 0, 0);
        if (!isNaN(jDate.getTime()) && jDate.getTime() > activeCycleStart.getTime() && jDate.getTime() <= activeDueDate.getTime()) {
            activeCycleStart = jDate;
        }
    }

    const diffTime = activeDueDate.getTime() - todayZero.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let feeStatus: 'good' | 'upcoming' | 'due' | 'overdue';
    if (hasPaidCurr) {
        feeStatus = 'good';
    } else {
        if (daysRemaining < 0) {
            feeStatus = 'overdue';
        } else if (daysRemaining === 0) {
            feeStatus = 'due';
        } else if (daysRemaining <= 3) {
            feeStatus = 'upcoming';
        } else {
            feeStatus = 'good';
        }
    }

    const day = activeDueDate.getDate();
    const monthName = activeDueDate.toLocaleString('en-US', { month: 'long' });
    const formattedDueDate = `${day} ${monthName}`;
    const hasPendingPayment = payments.some(p => p.status === 'pending_approval');

    return {
        cycleStart: formatDateToYYYYMMDD(activeCycleStart),
        cycleEnd: formatDateToYYYYMMDD(activeDueDate),
        nextDueDate: formatDateToYYYYMMDD(activeDueDate),
        formattedDueDate,
        daysRemaining,
        feeStatus,
        hasPendingPayment
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
    metrics: StudentFeeCycleMetrics;
    sessions: FeeCycleSessionItem[];
    diagnostics: FeeCycleDiagnostic[];
    summary: {
        entitledClasses: number;
        consumedClasses: number;       // regularAttended + unexcusedMissed + makeupsCompleted
        creditsRemaining: number;      // Financial unused credits (entitled - consumed)
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
    };
    classrooms?: { id: string; name?: string; type?: string }[];
    batchSchedules?: { classroom_id: string; day_of_week: number; start_time?: string; end_time?: string }[];
    attendance?: { id?: string; student_id?: string; classroom_id: string; date?: string; session_date?: string; status: string }[];
    overrides?: { id?: string; student_id?: string; target_classroom_id: string; override_date: string; reason?: string | null }[];
    leaveRequests?: { id?: string; student_id?: string; classroom_id?: string; class_date: string; status: string }[];
    payments?: { payment_date: string; status?: string; classes_added?: number }[];
    cancelledSessions?: { classroom_id?: string; date: string }[];
    today?: Date;
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

    // 1. Handling per-class students
    if (feesBasis === 'class') {
        const storedCredits = typeof student.fees_classes_paid === 'number' ? student.fees_classes_paid : 0;
        const available = Math.max(0, storedCredits);

        const metrics: StudentFeeCycleMetrics = {
            studentId,
            feesBasis: 'class',
            basis: 'class',
            cycleStart: '',
            nextDueDate: '',
            formattedDueDate: 'Per-Class Prepaid',
            entitledClasses: available,
            creditsRemaining: available,
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
            statusLabel: available === 0 ? 'No Prepaid Credits' : `${available} Prepaid`,
            badgeVariant: available > 2 ? 'good' : available > 0 ? 'warning' : 'danger'
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
                entitledClasses: available,
                consumedClasses: 0,
                creditsRemaining: available,
                operationalOpportunities: available,
                unresolvedSessions: 0,
                classesAvailable: available,
                hasDiscrepancy: false
            }
        };
    }

    // 2. Derive half-open billing cycle [cycleStart <= date < nextDueDate)
    const cycle = getStudentBillingCycle(
        student.fees_collection_date,
        payments,
        today,
        student.join_date
    );

    const { cycleStart, nextDueDate, formattedDueDate, daysRemaining } = cycle;

    // Monthly entitlement: 4 classes standard, or classes_added from cycle payment if specified
    let entitledClasses = 4;
    const cyclePayments = payments.filter(
        p => (!p.status || p.status === 'approved') && p.payment_date >= cycleStart && p.payment_date < nextDueDate
    );
    if (cyclePayments.length > 0 && typeof cyclePayments[0].classes_added === 'number' && cyclePayments[0].classes_added > 0) {
        entitledClasses = cyclePayments[0].classes_added;
    }

    // Classroom lookups
    const classroomMap = new Map<string, string>();
    classrooms.forEach(c => {
        if (c.id) classroomMap.set(c.id, c.name || 'Regular Batch');
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

    // Student attendance records inside this billing cycle
    const normalizedAttendance = attendance
        .filter(a => !a.student_id || a.student_id === studentId)
        .map(a => ({
            ...a,
            student_id: studentId,
            date: a.date || a.session_date || ''
        }));
    const cycleAttendance = normalizedAttendance.filter(a => a.date >= cycleStart && a.date < nextDueDate);

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

    // Map regular session date -> attendance record
    const regularAttendanceByDate = new Map<string, typeof cycleAttendance[0]>();

    cycleAttendance.forEach(a => {
        if (isMakeupAttendance(a)) {
            // makeup attendance handled separately in makeup reconciliation
            return;
        }
        regularAttendanceByDate.set(a.date, a);
        if (a.status === 'present' || a.status === 'late') {
            regularAttended++;
        } else if (a.status === 'absent') {
            unexcusedMissed++;
        } else if (a.status === 'excused') {
            excusedMissed++;
        }
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

        if (scheduledDows.has(iterDow)) {
            const sched = scheduleByDow.get(iterDow);
            const classId = sched?.classroom_id || (classrooms[0]?.id ?? '');
            const className = classroomMap.get(classId) || classrooms[0]?.name || 'Batch Classroom';
            const timeSlot = sched?.start_time
                ? `${sched.start_time.slice(0, 5)} - ${sched.end_time?.slice(0, 5) || ''}`
                : undefined;

            const hasAttendance = regularAttendanceByDate.has(iterDateStr);
            const attRecord = regularAttendanceByDate.get(iterDateStr);
            const isCancelled = cancelledDates.has(iterDateStr);
            const hasApprovedLeave = approvedLeaveDates.has(iterDateStr);

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
            } else if (hasAttendance && attRecord) {
                if (attRecord.status === 'present' || attRecord.status === 'late') {
                    const isLate = attRecord.status === 'late';
                    sessions.push({
                        id: `reg-${iterDateStr}-${classId}`,
                        date: iterDateStr,
                        displayDate,
                        dayName,
                        timeSlot,
                        classroomId: classId,
                        classroomName: className,
                        sessionType: 'regular',
                        status: 'attended',
                        statusLabel: isLate ? '🕒 Attended (Late)' : '✅ Attended',
                        creditImpact: 'consumed',
                        creditImpactLabel: '1 class consumed',
                        isDiscrepancy: false,
                        actionUrl: `/teacher-dashboard/attendance?date=${iterDateStr}&classId=${classId}`,
                        actionLabel: 'View Attendance →',
                        notes: isLate ? 'Marked late (counts as attended).' : 'Marked present.'
                    });
                } else if (attRecord.status === 'absent') {
                    sessions.push({
                        id: `reg-${iterDateStr}-${classId}`,
                        date: iterDateStr,
                        displayDate,
                        dayName,
                        timeSlot,
                        classroomId: classId,
                        classroomName: className,
                        sessionType: 'regular',
                        status: 'absent',
                        statusLabel: '❌ Absent',
                        creditImpact: 'consumed',
                        creditImpactLabel: '1 class consumed (unexcused)',
                        isDiscrepancy: false,
                        actionUrl: `/teacher-dashboard/attendance?date=${iterDateStr}&classId=${classId}`,
                        actionLabel: 'Review Attendance →',
                        notes: 'Unexcused absence. Consumes 1 class credit per policy.'
                    });
                } else if (attRecord.status === 'excused') {
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
                        statusLabel: '🟠 Excused',
                        creditImpact: 'not_consumed',
                        creditImpactLabel: '0 classes consumed (makeup eligible)',
                        isDiscrepancy: false,
                        actionUrl: `/teacher-dashboard/attendance?date=${iterDateStr}&classId=${classId}`,
                        actionLabel: 'View Record →',
                        notes: 'Absence marked as excused. Grants makeup eligibility.'
                    });
                }
            } else {
                // No attendance record
                if (hasApprovedLeave) {
                    if (!regularAttendanceByDate.has(iterDateStr)) {
                        excusedMissed++;
                    }
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
    cycleAttendance.forEach(a => {
        if (a.status === 'excused' && !isMakeupAttendance(a)) {
            excusedDates.add(a.date);
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

    // 5. Entitlement Capping Formula (User Requirement #1)
    const creditsRemaining = Math.max(
        0,
        entitledClasses - regularAttended - unexcusedMissed - makeupsCompleted
    );

    const validOutstandingMakeupEntitlements = makeupsPending + makeupsScheduled;
    const operationalOpportunities = regularFuture + validOutstandingMakeupEntitlements;
    const classesAvailable = Math.min(creditsRemaining, operationalOpportunities);

    // Adjustment #2: Distinguish financial credits from operational availability
    const consumedClasses = regularAttended + unexcusedMissed + makeupsCompleted;
    const hasDiscrepancy = creditsRemaining > 0 && classesAvailable === 0 && unresolvedSessions > 0;

    if (hasDiscrepancy) {
        diagnostics.unshift({
            type: 'calculation_mismatch',
            severity: 'warning',
            title: `${creditsRemaining} Credit Unresolved`,
            detail: `The student has ${creditsRemaining} unused financial credit(s), but operational available classes report 0 because ${unresolvedSessions} scheduled session(s) in the past have no attendance marked. Once marked or excused, the balance will reconcile.`
        });
    }

    // 6. Visual status label & badge variant
    let statusLabel = 'Cycle Complete';
    let badgeVariant: 'good' | 'warning' | 'danger' | 'neutral' = 'neutral';
    let alertType: 'unresolved' | 'due' | 'overdue' | undefined;

    if (unresolvedSessions > 0) {
        statusLabel = `Attendance Review Needed (${unresolvedSessions} unresolved)`;
        badgeVariant = 'warning';
        alertType = 'unresolved';
    } else if (classesAvailable === 0) {
        if (unexcusedMissed > 0 && regularAttended + unexcusedMissed >= entitledClasses) {
            statusLabel = 'Cycle Complete · Forfeited';
        } else {
            statusLabel = 'Cycle Complete';
        }
        badgeVariant = 'neutral';
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
        statusLabel = parts.join(' · ') || `${classesAvailable} Classes Left`;
        badgeVariant = classesAvailable === 1 ? 'warning' : 'good';
    }

    const metrics: StudentFeeCycleMetrics = {
        studentId,
        feesBasis: 'monthly',
        basis: 'monthly',
        cycleStart,
        nextDueDate,
        formattedDueDate,
        entitledClasses,
        creditsRemaining,
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
        alertType
    };

    return {
        studentId,
        feesBasis: 'monthly',
        cycleStart,
        nextDueDate,
        formattedDueDate,
        daysRemaining,
        metrics,
        sessions,
        diagnostics,
        summary: {
            entitledClasses,
            consumedClasses,
            creditsRemaining,
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

