import { supabaseAuth } from './supabase-auth';
import { htmlToPlainText } from './text-utils';

interface SendNotificationParams {
    teacherId?: string;
    recipients?: Array<{ id: string; name: string; type: 'global' | 'class' | 'student' | 'custom' }>;
    title: string;
    message: string;
    studentIds?: string[];
    type?: 'reminder' | 'live_class' | 'messages' | 'tasks' | 'task' | 'classroom' | 'curriculum' | 'attendance' | 'fees';
}

async function resolveRecipientsToStudentIds(
    recipients: Array<{ id: string; name: string; type: 'global' | 'class' | 'student' | 'custom' }>
): Promise<string[]> {
    const studentIdsSet = new Set<string>();
    const classIds: string[] = [];
    const customIds: string[] = [];
    let hasGlobal = false;

    for (const recipient of recipients) {
        if (recipient.type === 'global') {
            hasGlobal = true;
        } else if (recipient.type === 'class') {
            classIds.push(recipient.id);
        } else if (recipient.type === 'student') {
            studentIdsSet.add(recipient.id);
        } else if (recipient.type === 'custom') {
            customIds.push(recipient.id);
        }
    }

    const promises: Promise<any>[] = [];

    // 1. Global recipients
    if (hasGlobal) {
        promises.push(
            (async () => {
                const { data: students } = await supabaseAuth
                    .from('users')
                    .select('id')
                    .eq('role', 'student');
                (students || []).forEach(s => studentIdsSet.add(s.id));
            })()
        );
    }

    // 2. Class recipients (batched in single queries for permanent + today's makeup students)
    if (classIds.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        promises.push(
            (async () => {
                const { data: permStudents } = await supabaseAuth
                    .from('classroom_students')
                    .select('student_id')
                    .in('classroom_id', classIds);
                (permStudents || []).forEach(s => studentIdsSet.add(s.student_id));
            })()
        );
        promises.push(
            (async () => {
                const { data: overrideStudents } = await supabaseAuth
                    .from('session_student_overrides')
                    .select('student_id')
                    .in('target_classroom_id', classIds)
                    .eq('override_date', today);
                (overrideStudents || []).forEach(s => studentIdsSet.add(s.student_id));
            })()
        );
    }

    // 3. Custom recipient groups (batched)
    if (customIds.length > 0) {
        promises.push(
            (async () => {
                const { data: groupsData } = await supabaseAuth
                    .from('custom_recipient_groups')
                    .select('recipients')
                    .in('id', customIds);
                const nestedRecipients: Array<{ id: string; name: string; type: 'global' | 'class' | 'student' | 'custom' }> = [];
                (groupsData || []).forEach(g => {
                    if (g.recipients && Array.isArray(g.recipients)) {
                        nestedRecipients.push(...(g.recipients as any));
                    }
                });
                if (nestedRecipients.length > 0) {
                    const subIds = await resolveRecipientsToStudentIds(nestedRecipients);
                    subIds.forEach(id => studentIdsSet.add(id));
                }
            })()
        );
    }

    await Promise.all(promises);
    return Array.from(studentIdsSet);
}

export async function sendClassroomNotification({
    recipients,
    title,
    message,
    studentIds: providedStudentIds,
    type
}: SendNotificationParams) {
    try {
        let studentIds: string[] = [];

        if (providedStudentIds && providedStudentIds.length > 0) {
            // Deduplicate recipient IDs
            studentIds = Array.from(new Set(providedStudentIds.filter(Boolean)));
        } else if (recipients && recipients.length > 0) {
            studentIds = await resolveRecipientsToStudentIds(recipients);
        }

        if (studentIds.length === 0) {
            console.log('[notifications] No target student IDs resolved.');
            return { success: true, count: 0 };
        }

        const cleanTitle = htmlToPlainText(title);
        const cleanMessage = htmlToPlainText(message);

        // Determine notification type
        const notifType = type || (cleanTitle.toLowerCase().includes('class started') ? 'live_class' : 'reminder');

        // 1. Batch insert into notifications table
        const notificationInserts = studentIds.map(sid => ({
            user_id: sid,
            title: cleanTitle,
            message: cleanMessage,
            type: notifType,
            is_read: false
        }));

        const { error: dbError } = await supabaseAuth
            .from('notifications')
            .insert(notificationInserts);

        if (dbError) {
            console.error('[notifications] DB insert error:', dbError);
        } else {
            console.log('[notifications] Saved in-app notifications successfully.');
        }

        // 2. Trigger OneSignal push notification serverless route
        const { data: { session } } = await supabaseAuth.auth.getSession();
        const token = session?.access_token;

        const res = await fetch('/api/notifications/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                studentIds,
                title: cleanTitle,
                message: cleanMessage
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[notifications] Push api error response:', errText);
        } else {
            console.log('[notifications] Triggered push notifications API successfully.');
        }

        return { success: true, count: studentIds.length };
    } catch (error) {
        console.error('[notifications] Error in sendClassroomNotification:', error);
        return { success: false, error };
    }
}
