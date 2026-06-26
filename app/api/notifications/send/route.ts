import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAuthUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL || '';
const supabaseAuthAnonKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY || '';

// Initialize server-side Supabase client for verifying user role
const supabase = createClient(supabaseAuthUrl, supabaseAuthAnonKey);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { studentIds, title, message } = body;

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return NextResponse.json({ error: 'Missing or invalid studentIds' }, { status: 400 });
        }
        if (!title || !message) {
            return NextResponse.json({ error: 'Missing title or message' }, { status: 400 });
        }

        // Verify authorization
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.error('[API Send Notification] Auth error:', authError);
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        // Check if the user is a teacher or admin in public.users table
        const { data: dbUser, error: dbError } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        if (dbError || !dbUser) {
            console.error('[API Send Notification] Database user fetch error:', dbError);
            return NextResponse.json({ error: 'Unauthorized: User record not found' }, { status: 401 });
        }

        if (dbUser.role !== 'teacher' && dbUser.role !== 'admin') {
            console.warn(`[API Send Notification] User ${user.id} tried to send notification but is a ${dbUser.role}`);
            return NextResponse.json({ error: 'Forbidden: Only teachers or admins can send notifications' }, { status: 403 });
        }

        // OneSignal Keys
        const oneSignalAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        const oneSignalRestApiKey = process.env.ONESIGNAL_REST_API_KEY;

        if (!oneSignalAppId || !oneSignalRestApiKey) {
            console.warn('[API Send Notification] OneSignal environment variables are not configured');
            return NextResponse.json({ 
                warning: 'OneSignal environment variables missing. In-app notifications created but push skipped.' 
            }, { status: 200 });
        }

        // Call OneSignal REST API to trigger push notification
        const payload = {
            app_id: oneSignalAppId,
            contents: { en: message },
            headings: { en: title },
            include_aliases: {
                external_id: studentIds
            },
            target_channel: 'push',
            priority: 10 // High priority to ensure instant system popup and sound alerts
        };

        console.log('[API Send Notification] Sending push payload to OneSignal:', JSON.stringify(payload));

        const oneSignalRes = await fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Key ${oneSignalRestApiKey}`
            },
            body: JSON.stringify(payload)
        });

        const oneSignalData = await oneSignalRes.json();

        if (!oneSignalRes.ok) {
            console.error('[API Send Notification] OneSignal response error:', oneSignalData);
            return NextResponse.json({ 
                error: 'Failed to deliver push notification via OneSignal', 
                details: oneSignalData 
            }, { status: 502 });
        }

        console.log('[API Send Notification] Push sent successfully:', oneSignalData);
        return NextResponse.json({ success: true, response: oneSignalData });
    } catch (err: any) {
        console.error('[API Send Notification] Catch block error:', err);
        return NextResponse.json({ error: 'Internal Server Error', details: err.message || err }, { status: 500 });
    }
}
