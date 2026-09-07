import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CHANNEL_ID = 'UCvPazG1RAthrmgDi1F0rRHw';
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const supabaseAuthUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL || '';
const supabaseAuthAnonKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY || '';

export const dynamic = 'force-dynamic';

// Simple regex-based XML field extractor
function extractTag(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match ? match[1].trim() : '';
}

function extractAttr(xml: string, tag: string, attr: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i'));
    return match ? match[1].trim() : '';
}

export async function GET(req: Request) {
    try {
        // Check if YouTube feed is paused by Admin strictly via RPC
        if (supabaseAuthUrl && supabaseAuthAnonKey) {
            try {
                const authHeader = req.headers.get('authorization');
                const supabase = createClient(supabaseAuthUrl, supabaseAuthAnonKey, {
                    auth: { persistSession: false },
                    global: {
                        headers: authHeader ? { Authorization: authHeader } : {}
                    }
                });
                const { data: rpcData } = await supabase.rpc('get_system_notification_settings');
                if (rpcData && rpcData.video_enabled === false) {
                    return NextResponse.json({ disabled: true, message: 'YouTube feed is paused by administrator' });
                }
            } catch (checkErr) {
                console.warn('[latest-youtube-video] Could not check pause settings:', checkErr);
            }
        }

        const res = await fetch(RSS_URL, {
            cache: 'no-store',
            headers: { 'Accept': 'application/xml, text/xml' }
        });

        if (!res.ok) {
            return NextResponse.json({ error: 'Failed to fetch RSS feed' }, { status: 502 });
        }

        const xml = await res.text();

        // Extract the first <entry> block (most recent video)
        const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/i);
        if (!entryMatch) {
            return NextResponse.json({ error: 'No videos found' }, { status: 404 });
        }

        const entry = entryMatch[1];

        const videoId = extractTag(entry, 'yt:videoId');
        const title = extractTag(entry, 'title');
        const published = extractTag(entry, 'published');
        const description = extractTag(entry, 'media:description');
        const thumbnail = extractAttr(entry, 'media:thumbnail', 'url') ||
            (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');

        if (!videoId || !title) {
            return NextResponse.json({ error: 'Could not parse video data' }, { status: 500 });
        }

        return NextResponse.json({
            videoId,
            title,
            published,
            description: description.slice(0, 200),
            thumbnail,
            url: `https://www.youtube.com/watch?v=${videoId}`
        });
    } catch (err) {
        console.error('[latest-youtube-video] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
