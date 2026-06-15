import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const origin = requestUrl.origin;

    if (code) {
        // Exchange the code for a session using the anon key (server-side)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data.user) {
            const userId = data.user.id;
            const userEmail = data.user.email || '';
            const userName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || '';

            // Check if user already exists in public.users
            const { data: existing } = await supabase
                .from('users')
                .select('role')
                .eq('id', userId)
                .maybeSingle();

            if (!existing) {
                // New Google user — insert them as a student with pending status
                await supabase.from('users').insert([{
                    id: userId,
                    name: userName,
                    email: userEmail,
                    role: 'student',
                    status: 'pending',
                    join_date: new Date().toISOString().split('T')[0],
                }]);

                // Redirect to pending approval page for new Google sign-up users
                return NextResponse.redirect(`${origin}/pending-approval`);
            }

            // Existing user — redirect based on role
            const role = existing.role?.toLowerCase();
            if (role === 'admin') return NextResponse.redirect(`${origin}/admin-dashboard`);
            if (role === 'teacher') return NextResponse.redirect(`${origin}/teacher-dashboard`);
            if (role === 'student') return NextResponse.redirect(`${origin}/student-dashboard`);
        }
    }

    // Fallback — redirect to login if anything goes wrong
    return NextResponse.redirect(`${origin}/login`);
}
