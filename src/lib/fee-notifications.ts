import { SupabaseClient } from '@supabase/supabase-js';
import { calculateAuthoritativeFeeStatus } from './fee-utils';

interface FeeTransitionNotificationParams {
    studentId: string;
    studentName?: string;
    teacherId?: string | null;
    supabase: SupabaseClient;
}

/**
 * Idempotently handles Fee Transition notifications when a student's financial state changes:
 * Transition A: GOOD_STANDING -> FEE_DUE (balance = 0)
 *   Student: "Fee Payment Due" / "You have completed all classes in your current package. Please complete your next fee payment."
 *   Teacher/Admin: "[Student Name] has completed all paid classes. Next fee payment is due."
 * 
 * Transition B: FEE_DUE -> PAYMENT_OVERDUE (balance < 0)
 *   Student: "Fee Payment Pending" / "Your fee payment is pending. Please complete the payment to continue your classes. Live class access has been paused."
 *   Teacher/Admin: "[Student Name]'s fee payment is pending. Live class access has been paused."
 * 
 * Invariants:
 * - Triggered ONLY from mutation flows (attendance marking), never on page load or GET.
 * - Idempotent per cycle: duplicate notifications for the same transition in the same cycle are suppressed.
 */
export async function handleFeeBalanceTransitionNotifications({
    studentId,
    studentName,
    teacherId,
    supabase
}: FeeTransitionNotificationParams): Promise<{ sent: boolean; reason?: string }> {
    try {
        // 1. Fetch current student profile
        const { data: student, error: stdErr } = await supabase
            .from('users')
            .select('id, name, teacher_id, fees_basis, fees_classes_paid, fees_amount, fees_collection_date, join_date')
            .eq('id', studentId)
            .maybeSingle();

        if (stdErr || !student) {
            return { sent: false, reason: 'Student not found' };
        }

        const effectiveStudentName = studentName || student.name || 'Student';
        const effectiveTeacherId = teacherId || student.teacher_id;

        // 2. Concurrently fetch payments, attendance, overrides, and leaves to determine authoritative status
        const [paymentsRes, attendanceRes, overridesRes, leavesRes] = await Promise.all([
            supabase.from('fees_payments').select('*').eq('student_id', studentId),
            supabase.from('attendance').select('*').eq('student_id', studentId),
            supabase.from('session_student_overrides').select('*').eq('student_id', studentId),
            supabase.from('leave_requests').select('*').eq('student_id', studentId).eq('status', 'approved')
        ]);

        const authStatus = calculateAuthoritativeFeeStatus({
            studentId,
            student,
            payments: paymentsRes.data || [],
            attendance: attendanceRes.data || [],
            overrides: overridesRes.data || [],
            leaveRequests: leavesRes.data || [],
            today: new Date()
        });

        const effectiveBalance = authStatus.effectiveBalance;

        // Balance > 0 means student is in GOOD_STANDING (no notifications needed)
        if (effectiveBalance > 0) {
            return { sent: false, reason: `Balance is ${effectiveBalance} > 0 (Good Standing)` };
        }

        // Determine transition target
        const isOverdueTransition = effectiveBalance < 0;
        const notificationType = isOverdueTransition ? 'fee_overdue' : 'classes_completed';

        // 3. Idempotency Check: Check if this transition notification was already logged for this cycle
        let duplicateQuery = supabase
            .from('fees_notifications')
            .select('id, sent_at')
            .eq('student_id', studentId)
            .eq('notification_type', notificationType);

        if (authStatus.lastPaymentDate) {
            duplicateQuery = duplicateQuery.gte('sent_at', authStatus.lastPaymentDate);
        }

        const { data: existingLogs } = await duplicateQuery.limit(1);
        if (existingLogs && existingLogs.length > 0) {
            return { sent: false, reason: `${notificationType} notification already sent for current paid cycle` };
        }

        const studentTitle = isOverdueTransition ? 'Fee Payment Pending' : 'Fee Payment Due';
        const studentMessage = isOverdueTransition
            ? 'Your fee payment is pending. Please complete the payment to continue your classes. Live class access has been paused.'
            : 'You have completed all classes in your current package. Please complete your next fee payment.';

        const teacherTitle = isOverdueTransition
            ? `Payment Pending: ${effectiveStudentName}`
            : `Fee Due: ${effectiveStudentName}`;
        const teacherMessage = isOverdueTransition
            ? `${effectiveStudentName}'s fee payment is pending. Live class access has been paused.`
            : `${effectiveStudentName} has completed all paid classes. Next fee payment is due.`;

        // 4. Log in fees_notifications for idempotency tracking
        await supabase.from('fees_notifications').insert([{
            student_id: studentId,
            notification_type: notificationType,
            channel: 'in_app',
            status: 'sent'
        }]);

        // 5. Send Student in-app notification
        await supabase.from('notifications').insert([{
            user_id: studentId,
            title: studentTitle,
            message: studentMessage,
            type: 'fees',
            is_read: false
        }]);

        // 6. Send Teacher & Admin notifications
        const recipientAdminTeacherIds = new Set<string>();
        if (effectiveTeacherId) {
            recipientAdminTeacherIds.add(effectiveTeacherId);
        }

        const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
        if (admins) {
            admins.forEach((a: any) => recipientAdminTeacherIds.add(a.id));
        }

        if (recipientAdminTeacherIds.size > 0) {
            const adminNotifs = Array.from(recipientAdminTeacherIds).map(uid => ({
                user_id: uid,
                title: teacherTitle,
                message: teacherMessage,
                type: 'fees',
                is_read: false
            }));
            await supabase.from('notifications').insert(adminNotifs);
        }

        return { sent: true };
    } catch (err: any) {
        console.error('[FeeNotification] Error checking fee balance transition:', err);
        return { sent: false, reason: err.message };
    }
}
