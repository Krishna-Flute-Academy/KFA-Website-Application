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
    const email = 'teacher_test_' + Math.random().toString(36).substring(7) + '@example.com';
    const password = 'Password123!';
    const name = 'Test Teacher';

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

    console.log('Sign up successful! User ID:', signUpData.user?.id);

    // Wait a brief moment for any database triggers to run
    await new Promise(resolve => setTimeout(resolve, 2000));

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
    const authenticatedClient = createClient(url, anonKey, {
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    });

    console.log('Step 3: Checking if teacher profile exists in public.users...');
    const { data: profile, error: profileError } = await authenticatedClient
        .from('users')
        .select('*')
        .eq('id', signInData.user?.id)
        .single();

    if (profileError) {
        console.error('Error fetching teacher profile:', profileError);
    } else {
        console.log('Teacher profile:', profile);
    }

    console.log('Step 4: Trying to insert a new student as the authenticated teacher...');
    const { data: studentData, error: studentError } = await authenticatedClient
        .from('users')
        .insert([{
            name: 'Test Student',
            email: 'student_test_' + Math.random().toString(36).substring(7) + '@example.com',
            phone: '1234567890',
            role: 'student',
            status: 'active',
            teacher_id: signInData.user?.id,
            join_date: new Date().toISOString().split('T')[0],
            level: 'beginner',
            profile_pic_url: '',
            notes: 'Test note'
        }])
        .select()
        .single();

    if (studentError) {
        console.error('Student insert failed:');
        console.error('Message:', studentError.message);
        console.error('Details:', studentError.details);
        console.error('Hint:', studentError.hint);
        console.error('Code:', studentError.code);
    } else {
        console.log('Success! Student inserted:', studentData);
    }
}

runTest();
