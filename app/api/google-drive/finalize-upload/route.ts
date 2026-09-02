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

        // 2. Validate payload
        const body = await req.json().catch(() => null);
        const { fileId, assignmentId } = body || {};

        if (!fileId || typeof fileId !== 'string') {
            return NextResponse.json({ error: 'Bad Request: Missing fileId.' }, { status: 400 });
        }

        const webViewLink = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;

        // 3. If assignmentId is provided, resolve teacher email and grant reader permission
        if (assignmentId) {
            try {
                const { data: asg } = await supabase
                    .from('assignments')
                    .select('classroom_id, teacher_id')
                    .eq('id', assignmentId)
                    .maybeSingle();

                let teacherEmail: string | null = null;
                let teacherId = asg?.teacher_id || null;

                if (!teacherId && asg?.classroom_id) {
                    const { data: classRow } = await supabase
                        .from('classrooms')
                        .select('teacher_id')
                        .eq('id', asg.classroom_id)
                        .maybeSingle();
                    teacherId = classRow?.teacher_id || null;
                }

                if (!teacherId) {
                    const { data: studentRow } = await supabase
                        .from('users')
                        .select('teacher_id')
                        .eq('id', user.id)
                        .maybeSingle();
                    teacherId = studentRow?.teacher_id || null;
                }

                if (teacherId) {
                    const { data: teacherUser } = await supabase
                        .from('users')
                        .select('email')
                        .eq('id', teacherId)
                        .maybeSingle();
                    teacherEmail = teacherUser?.email || null;
                }

                // If teacher email is present and not the academy admin account, grant reader access
                if (teacherEmail && teacherEmail.trim().toLowerCase() !== 'kgbhaumik86@gmail.com') {
                    const { accessToken } = await getAcademyGoogleAccessToken();
                    const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=false&supportsAllDrives=true`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            role: 'reader',
                            type: 'user',
                            emailAddress: teacherEmail.trim(),
                        }),
                    });

                    if (!permRes.ok) {
                        const permErr = await permRes.text();
                        console.warn('Teacher permission creation warning:', {
                            status: permRes.status,
                            body: permErr,
                            teacherEmail,
                        });
                    }
                }
            } catch (permException) {
                console.error('Error granting teacher permission in finalize-upload:', permException);
            }
        }

        return NextResponse.json({
            success: true,
            fileId,
            webViewLink,
        });

    } catch (err: any) {
        console.error('Error in /api/google-drive/finalize-upload:', err);
        return NextResponse.json({ 
            error: err.message || 'Internal server error finalizing upload.' 
        }, { status: 500 });
    }
}
