import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { htmlToPlainText } from '../../../../src/lib/text-utils';
import fs from 'fs';
import path from 'path';

// Fallback env reader to robustly handle server environment loading and avoid server restart issues
function getEnvVariable(key: string): string {
    if (process.env[key]) return process.env[key]!;
    try {
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                const parts = line.split('=');
                if (parts[0]?.trim() === key) {
                    return parts.slice(1).join('=').trim();
                }
            }
        }
    } catch (e) {
        console.error('Error reading fallback env:', e);
    }
    return '';
}

const supabaseAuthUrl = getEnvVariable('NEXT_PUBLIC_AUTH_SUPABASE_URL');
const supabaseAuthAnonKey = getEnvVariable('NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY');

// Set VAPID keys for direct web push delivery
const vapidPublicKey = getEnvVariable('NEXT_PUBLIC_VAPID_PUBLIC_KEY');
const vapidPrivateKey = getEnvVariable('VAPID_PRIVATE_KEY');

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

        // Verify token using a clean Supabase client configured with the token globally and persistSession: false
        const supabaseAuthClient = createClient(supabaseAuthUrl, supabaseAuthAnonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            },
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        });
        const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser();

        // Initialize Supabase database client dynamically with the user's token so queries run with RLS context of the teacher/admin,
        // or bypass RLS if the system service role key is available.
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = serviceRoleKey 
            ? createClient(supabaseAuthUrl, serviceRoleKey, { auth: { persistSession: false } })
            : createClient(supabaseAuthUrl, supabaseAuthAnonKey, {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            });

        if (authError || !user) {
            console.error('[API Send Notification] Auth error:', authError);
            return NextResponse.json({ 
                error: 'Unauthorized: Invalid token',
                details: authError?.message || 'Unknown auth error',
                debug: {
                    url: supabaseAuthUrl,
                    hasKey: !!supabaseAuthAnonKey,
                    tokenLength: token?.length
                }
            }, { status: 401 });
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

        if (!studentIds || studentIds.length === 0) {
            console.log('[API Send Notification] No active push subscriptions found for targeted students.');
            return NextResponse.json({ success: true, sentCount: 0 });
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
            title: htmlToPlainText(title),
            body: htmlToPlainText(message),
            url: '/student-dashboard',
            tag: 'class-session'
        });

        console.log(`[API Send Notification] Sending push notification to ${subscriptions.length} active device(s).`);

        // Send notifications in parallel
        const expiredEndpoints: string[] = [];
        const pushPromises = subscriptions.map(async (subRecord: any) => {
            try {
                await webpush.sendNotification(subRecord.subscription_json, payload);
            } catch (err: any) {
                // If subscription has expired or is invalid (404 or 410), clean it up from Supabase DB
                if (err.statusCode === 404 || err.statusCode === 410) {
                    console.log(`[API Send Notification] Pruning expired subscription: ${subRecord.endpoint}`);
                    expiredEndpoints.push(subRecord.endpoint);
                } else {
                    console.error('[API Send Notification] Push error for subscriber:', err);
                }
            }
        });

        await Promise.all(pushPromises);

        if (expiredEndpoints.length > 0) {
            await supabase
                .from('push_subscriptions')
                .delete()
                .in('endpoint', expiredEndpoints);
        }

        return NextResponse.json({ success: true, sentCount: subscriptions.length });
    } catch (err: any) {
        console.error('[API Send Notification] Catch block error:', err);
        return NextResponse.json({ error: 'Internal Server Error', details: err.message || err }, { status: 500 });
    }
}
