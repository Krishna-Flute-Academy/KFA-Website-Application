import { createClient } from '@supabase/supabase-js';
import { sendClassroomNotification } from './notifications';

// Create a server-side Supabase client for task-reminders.
// Uses service role key if available (bypasses RLS), otherwise falls back to anon key.
// This avoids the "No API key found" error that occurs when the shared supabaseAuth
// singleton (designed for browser sessions) is used in a server/API route context.
function createServerClient() {
    const url = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const anonKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY || '';
    const key = serviceRoleKey || anonKey;
    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}

export async function checkAndSendTaskDueReminders() {
    try {
        console.log('[task-reminders] Running 2-day pre-due-date task reminder check...');

        // 1. Fetch all active/published assignments that have a due date
        const db = createServerClient();
        const { data: assignments, error: asgError } = await db
            .from('assignments')
            .select('id, title, due_date, teacher_id, classroom_id, target_type, status')
            .not('due_date', 'is', null);

        if (asgError || !assignments || assignments.length === 0) {
            console.log('[task-reminders] No assignments with due dates found.');
            return { success: true, processed: 0 };
        }

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        // 2. Identify tasks due in <= 2 days (e.g. 1 or 2 days remaining)
        const dueSoonTasks = assignments.filter(asg => {
            if (!asg.due_date || asg.status === 'draft') return false;
            
            const dueDateObj = new Date(asg.due_date);
            const dueStart = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate()).getTime();
            
            const diffDays = Math.round((dueStart - todayStart) / (1000 * 60 * 60 * 24));
            // Match tasks due in exactly 2 days, or up to 2 days away (0, 1, or 2 days remaining)
            return diffDays >= 0 && diffDays <= 2;
        });

        if (dueSoonTasks.length === 0) {
            console.log('[task-reminders] No tasks due in <= 2 days.');
            return { success: true, processed: 0 };
        }

        let totalRemindersSent = 0;

        for (const task of dueSoonTasks) {
            // 3. Find pending student submissions for this task
            const { data: pendingStudents, error: subError } = await db
                .from('assignment_students')
                .select('student_id, status')
                .eq('assignment_id', task.id)
                .eq('status', 'pending');

            if (subError || !pendingStudents || pendingStudents.length === 0) {
                continue;
            }

            const pendingStudentIds = pendingStudents.map(s => s.student_id);

            // 4. Fetch notifications sent today to avoid duplicate reminders
            const reminderTitle = `⏰ Task Due Reminder: ${task.title}`;
            const { data: existingNotifs } = await db
                .from('notifications')
                .select('user_id, created_at')
                .eq('type', 'reminder')
                .eq('title', reminderTitle)
                .in('user_id', pendingStudentIds);

            const alreadyRemindedStudentIds = new Set<string>();
            (existingNotifs || []).forEach(n => {
                const notifDate = new Date(n.created_at).toISOString().split('T')[0];
                if (notifDate === todayStr) {
                    alreadyRemindedStudentIds.add(n.user_id);
                }
            });

            // Filter out students who already received a reminder today
            const targetStudentIds = pendingStudentIds.filter(id => !alreadyRemindedStudentIds.has(id));

            if (targetStudentIds.length === 0) {
                continue;
            }

            const formattedDueDate = new Date(task.due_date!).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });

            const dueDateObj = new Date(task.due_date!);
            const dueStart = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate()).getTime();
            const diffDays = Math.round((dueStart - todayStart) / (1000 * 60 * 60 * 24));
            
            const daysText = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`;

            const message = `Reminder: Your task "${task.title}" is due ${daysText} (${formattedDueDate}). Please complete and submit your work on time!`;

            // 5. Send notifications
            const result = await sendClassroomNotification({
                teacherId: task.teacher_id || 'system',
                recipients: [{ id: 'custom', name: 'Pending Students', type: 'custom' }],
                title: reminderTitle,
                message,
                studentIds: targetStudentIds
            });

            if (result.success) {
                totalRemindersSent += targetStudentIds.length;
            }
        }

        console.log(`[task-reminders] Completed reminder check. Sent ${totalRemindersSent} reminder(s).`);
        return { success: true, processed: totalRemindersSent };
    } catch (err) {
        console.error('[task-reminders] Error in checkAndSendTaskDueReminders:', err);
        return { success: false, error: err };
    }
}
