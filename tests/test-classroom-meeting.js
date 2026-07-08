import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Parse .env manually
const envPath = './.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const url = env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;

console.log('Testing Supabase Auth with URL:', url);
const supabaseAuth = createClient(url, anonKey);

async function runTest() {
    const email = 'teacher_test_meeting_' + Math.random().toString(36).substring(7) + '@gmail.com';
    const password = 'Password123!';
    const name = 'Test Teacher Meeting';

    console.log(`Step 1: Signing up a new teacher: ${email}...`);
    const { data: signUpData, error: signUpError } = await supabaseAuth.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: name,
                phone: '9876543210',
                role: 'teacher',
            }
        }
    });

    if (signUpError) {
        console.error('Sign up failed:', signUpError);
        return;
    }

    const userId = signUpData.user?.id;
    console.log('Sign up successful! User ID:', userId);

    // Wait a brief moment for public.users trigger to run
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Step 2: Logging in as the new teacher...');
    const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
        email,
        password
    });

    if (signInError) {
        console.error('Sign in failed:', signInError);
        return;
    }

    const token = signInData.session?.access_token;
    console.log('Sign in successful! Token acquired.');

    // Create an authenticated client
    const authClient = createClient(url, anonKey, {
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    });

    console.log('Step 3: Creating a classroom for the teacher...');
    const { data: classroom, error: classError } = await authClient
        .from('classrooms')
        .insert([{
            name: 'Test Class',
            teacher_id: userId,
            type: 'permanent',
            status: 'active'
        }])
        .select()
        .single();

    if (classError) {
        console.error('Failed to create classroom:', classError);
        return;
    }

    const classroomId = classroom.id;
    console.log('Classroom created successfully. ID:', classroomId);

    console.log('Step 4: Starting the class (marking as live)...');
    const { data: startData, error: startError } = await authClient
        .from('classrooms')
        .update({
            is_live: true,
            live_meeting_link: 'https://zoom.us/test',
            live_session_started_at: new Date().toISOString()
        })
        .eq('id', classroomId)
        .select();

    if (startError) {
        console.error('Failed to start class:', startError);
    } else {
        console.log('Class started! Rows updated:', startData?.length);
        console.log(JSON.stringify(startData, null, 2));
    }

    console.log('Step 5: Ending the class (marking as offline)...');
    const { data: endData, error: endError } = await authClient
        .from('classrooms')
        .update({
            is_live: false,
            live_meeting_link: null,
            live_session_started_at: null
        })
        .eq('id', classroomId)
        .select();

    if (endError) {
        console.error('Failed to end class:', endError);
    } else {
        console.log('Class ended! Rows updated:', endData?.length);
        console.log(JSON.stringify(endData, null, 2));
    }
}

runTest();
