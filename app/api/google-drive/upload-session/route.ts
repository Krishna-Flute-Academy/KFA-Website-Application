import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAcademyGoogleAccessToken } from '../../../../src/lib/serverGoogleAuth';

export async function POST(req: Request) {
    try {
        // 1. Validate Supabase Auth Bearer token
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

        // 2. Validate request payload
        const body = await req.json().catch(() => null);
        if (!body) {
            return NextResponse.json({ error: 'Bad Request: Missing payload.' }, { status: 400 });
        }

        const { assignmentId, fileName, fileSize, mimeType } = body;

        if (!assignmentId || typeof assignmentId !== 'string') {
            return NextResponse.json({ error: 'Bad Request: Missing assignmentId.' }, { status: 400 });
        }

        if (!fileSize || typeof fileSize !== 'number' || fileSize <= 0) {
            return NextResponse.json({ error: 'Bad Request: Invalid fileSize.' }, { status: 400 });
        }

        // Limit maximum upload size to 500MB
        const MAX_SIZE_BYTES = 500 * 1024 * 1024;
        if (fileSize > MAX_SIZE_BYTES) {
            return NextResponse.json({ error: 'File is too large. Maximum size allowed is 500MB.' }, { status: 400 });
        }

        // Validate MIME type (must be video)
        const cleanMimeType = (mimeType || 'video/mp4').toLowerCase().trim();
        const isVideo = cleanMimeType.startsWith('video/') || 
            ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', '3gp'].some(ext => (fileName || '').toLowerCase().endsWith(`.${ext}`));

        if (!isVideo) {
            return NextResponse.json({ error: 'Invalid file type. Only video files are allowed.' }, { status: 400 });
        }

        // 3. Fetch Student Name and Assignment Title for clean filename
        const [{ data: studentData }, { data: assignmentData }] = await Promise.all([
            supabase.from('users').select('id, name').eq('id', user.id).maybeSingle(),
            supabase.from('assignments').select('id, title, classroom_id, teacher_id').eq('id', assignmentId).maybeSingle()
        ]);

        const studentName = (studentData?.name || 'Student').trim().replace(/[/\\?%*:|"<>]/g, '-');
        const assignmentTitle = (assignmentData?.title || 'Practice Task').trim().replace(/[/\\?%*:|"<>]/g, '-');
        const rawExt = (fileName || 'recording.mp4').split('.').pop() || 'mp4';
        const safeExt = rawExt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'mp4';

        // Format: Student Name - Assignment Title.ext (e.g. Vihaan Potdar - Practice Palta.mp4)
        const sanitizedFileName = `${studentName} - ${assignmentTitle}.${safeExt}`;

        // 4. Obtain Academy Google Drive Access Token
        const { accessToken, folderId, authType } = await getAcademyGoogleAccessToken();

        // 5. Initiate Google Drive Resumable Upload Session
        const metadata = {
            name: sanitizedFileName,
            parents: [folderId],
            description: `KFA Task Submission: ${assignmentTitle} by ${studentName} (Student ID: ${user.id}, Assignment ID: ${assignmentId})`
        };

        const googleRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Type': cleanMimeType,
                'X-Upload-Content-Length': fileSize.toString(),
            },
            body: JSON.stringify(metadata)
        });

        if (!googleRes.ok) {
            const errorBody = await googleRes.text();
            console.error('Google Drive Resumable Session Error', {
                status: googleRes.status,
                statusText: googleRes.statusText,
                authType,
                body: errorBody
            });

            return NextResponse.json({
                error: 'Could not start Google Drive upload session with storage provider.',
                details: errorBody,
                status: googleRes.status
            }, { status: 502 });
        }

        const uploadUrl = googleRes.headers.get('Location');
        if (!uploadUrl) {
            console.error('Google Drive Resumable Session: Location header missing.');
            return NextResponse.json({ error: 'Failed to retrieve upload session location from Google Drive.' }, { status: 502 });
        }

        return NextResponse.json({
            success: true,
            uploadUrl,
            fileName: sanitizedFileName
        });

    } catch (err: any) {
        console.error('Unhandled error in /api/google-drive/upload-session:', err);
        return NextResponse.json({ 
            error: err.message || 'Internal server error creating upload session.' 
        }, { status: 500 });
    }
}
