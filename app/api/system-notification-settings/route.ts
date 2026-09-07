import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAuthUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL || '';
const supabaseAuthAnonKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY || '';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        if (!supabaseAuthUrl || !supabaseAuthAnonKey) {
            return NextResponse.json({
                blog_enabled: true,
                video_enabled: true,
                featured_updates_enabled: false
            });
        }

        const authHeader = req.headers.get('authorization');
        const supabase = createClient(supabaseAuthUrl, supabaseAuthAnonKey, {
            auth: { persistSession: false },
            global: {
                headers: authHeader ? { Authorization: authHeader } : {}
            }
        });

        // Query strictly via the SECURITY DEFINER RPC function
        // (zero direct SELECT on message_templates table)
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_system_notification_settings');
        if (!rpcError && rpcData) {
            return NextResponse.json(rpcData, {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
                }
            });
        }

        return NextResponse.json({
            blog_enabled: true,
            video_enabled: true,
            featured_updates_enabled: false
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
            }
        });
    } catch (err) {
        console.error('[system-notification-settings API] Error:', err);
        return NextResponse.json({
            blog_enabled: true,
            video_enabled: true,
            featured_updates_enabled: false
        });
    }
}
