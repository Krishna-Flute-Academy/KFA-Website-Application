import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAcademyGoogleAccessToken } from '../../../src/lib/serverGoogleAuth';

export async function POST(req: Request) {
    try {
        // Require auth token from frontend
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
        }

        const supabaseToken = authHeader.replace('Bearer ', '').trim();
        const supabase = createClient(
            process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser(supabaseToken);
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized: Invalid user session.' }, { status: 401 });
        }

        const { accessToken, folderId } = await getAcademyGoogleAccessToken();

        return NextResponse.json({
            access_token: accessToken,
            folder_id: folderId
        });
    } catch (error: any) {
        console.error('Error in /api/google-drive-token:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
