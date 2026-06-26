import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseAuthUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL || '';
const supabaseAuthAnonKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY || '';

// Initialize server-side Supabase client for verifying user role and fetching subscriptions
const supabase = createClient(supabaseAuthUrl, supabaseAuthAnonKey);

// Set VAPID keys for direct web push delivery
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
        'mailto:info@krishnafluteacademy.com',
        vapidPublicKey,
        vapidPrivateKey
    );
}

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

        if (!vapidPublicKey || !vapidPrivateKey) {
            console.warn('[API Send Notification] VAPID keys are not configured in environment variables');
            return NextResponse.json({ 
                warning: 'VAPID keys missing. In-app notifications created but push skipped.' 
            }, { status: 200 });
        }

        // Fetch direct push subscriptions from Supabase for all targeted student IDs
        const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('endpoint, subscription_json')
            .in('user_id', studentIds);

        if (subError) {
            console.error('[API Send Notification] Failed to fetch subscriptions:', subError);
            return NextResponse.json({ error: 'Database fetch failed' }, { status: 500 });
        }

        if (!subscriptions || subscriptions.length === 0) {
            console.log('[API Send Notification] No active push subscriptions found for targeted students.');
            return NextResponse.json({ success: true, sentCount: 0 });
        }

        const payload = JSON.stringify({
            title,
            body: message,
            url: '/student-dashboard',
            tag: 'class-session'
        });

        console.log(`[API Send Notification] Sending push notification to ${subscriptions.length} active device(s).`);

        // Send notifications in parallel
        const pushPromises = subscriptions.map(async (subRecord: any) => {
            try {
                await webpush.sendNotification(subRecord.subscription_json, payload);
            } catch (err: any) {
                // If subscription has expired or is invalid (404 or 410), clean it up from Supabase DB
                if (err.statusCode === 404 || err.statusCode === 410) {
                    console.log(`[API Send Notification] Pruning expired subscription: ${subRecord.endpoint}`);
                    await supabase
                        .from('push_subscriptions')
                        .delete()
                        .eq('endpoint', subRecord.endpoint);
                } else {
                    console.error('[API Send Notification] Push error for subscriber:', err);
                }
            }
        });

        await Promise.all(pushPromises);

        return NextResponse.json({ success: true, sentCount: subscriptions.length });
    } catch (err: any) {
        console.error('[API Send Notification] Catch block error:', err);
        return NextResponse.json({ error: 'Internal Server Error', details: err.message || err }, { status: 500 });
    }
}
