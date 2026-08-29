import { supabaseAuth } from './supabase-auth';
import { htmlToPlainText } from './text-utils';

interface SendNotificationParams {
    teacherId: string;
    recipients: Array<{ id: string; name: string; type: 'global' | 'class' | 'student' | 'custom' }>;
    title: string;
    message: string;
    studentIds?: string[];
}

async function resolveRecipientsToStudentIds(
    recipients: Array<{ id: string; name: string; type: 'global' | 'class' | 'student' | 'custom' }>
): Promise<string[]> {
    const studentIdsSet = new Set<string>();

    for (const recipient of recipients) {
        if (recipient.type === 'global') {
            // Fetch all student users
            const { data: students } = await supabaseAuth
                .from('users')
                .select('id')
                .eq('role', 'student');
            (students || []).forEach(s => studentIdsSet.add(s.id));
        } else if (recipient.type === 'class') {
            // 1. Fetch permanent students in classroom
            const { data: permStudents } = await supabaseAuth
                .from('classroom_students')
                .select('student_id')
                .eq('classroom_id', recipient.id);
            (permStudents || []).forEach(s => studentIdsSet.add(s.student_id));

            // 2. Fetch makeup/override students in classroom for today
            const today = new Date().toISOString().split('T')[0];
            const { data: overrideStudents } = await supabaseAuth
                .from('session_student_overrides')
                .select('student_id')
                .eq('target_classroom_id', recipient.id)
                .eq('override_date', today);
            (overrideStudents || []).forEach(s => studentIdsSet.add(s.student_id));
        } else if (recipient.type === 'student') {
            studentIdsSet.add(recipient.id);
        } else if (recipient.type === 'custom') {
            // Fetch the custom group's sub-recipients
            const { data: groupData } = await supabaseAuth
                .from('custom_recipient_groups')
                .select('recipients')
                .eq('id', recipient.id)
                .maybeSingle();

            if (groupData?.recipients && Array.isArray(groupData.recipients)) {
                const subIds = await resolveRecipientsToStudentIds(groupData.recipients as any);
                subIds.forEach(id => studentIdsSet.add(id));
            }
        }
    }

    return Array.from(studentIdsSet);
}

export async function sendClassroomNotification({
    teacherId,
    recipients,
    title,
    message,
    studentIds: providedStudentIds
}: SendNotificationParams) {
    try {
        let studentIds: string[] = [];

        if (providedStudentIds && providedStudentIds.length > 0) {
            studentIds = providedStudentIds;
        } else {
            studentIds = await resolveRecipientsToStudentIds(recipients);
        }

        if (studentIds.length === 0) {
            console.log('[notifications] No target student IDs resolved.');
            return { success: true, count: 0 };
        }

        console.log(`[notifications] Targeting ${studentIds.length} students:`, studentIds);

        const cleanTitle = htmlToPlainText(title);
        const cleanMessage = htmlToPlainText(message);

        // 1. Insert into notifications table
        const notificationInserts = studentIds.map(sid => ({
            user_id: sid,
            title: cleanTitle,
            message: cleanMessage,
            type: 'reminder',
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
