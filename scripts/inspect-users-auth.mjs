import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('./.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    }
});

const url = env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;
const supabaseAuth = createClient(url, anonKey);

async function run() {
    const email = 'teacher_inspect_' + Math.random().toString(36).substring(7) + '@example.com';
    const password = 'Password123!';

    console.log('Signing up teacher:', email);
    const { data: signUpData, error: signUpError } = await supabaseAuth.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: 'Inspector Teacher', role: 'teacher' }
        }
    });

    if (signUpError) {
        console.error('Sign up error:', signUpError);
        return;
    }

    await new Promise(r => setTimeout(r, 1500));

    console.log('Signing in...');
    const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
        email,
        password
    });

    if (signInError) {
        console.error('Sign in error:', signInError);
        return;
    }

    const token = signInData.session?.access_token;
    console.log('Token acquired successfully.');

    const client = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: users, error: uErr } = await client.from('users').select('*');
    if (uErr) {
        console.error('Error fetching users:', uErr);
        return;
    }

    console.log('Total users count:', users.length);
    console.log('--- ALL USERS LIST ---');
    users.forEach((u, i) => {
        console.log(`[${i+1}] Name: "${u.name}" | Email: "${u.email}" | Role: "${u.role}" | Status: "${u.status}" | Level: "${u.level}" | ID: ${u.id}`);
    });

    console.log('\n--- SEARCH MATCHES ---');
    const matches = users.filter(u => {
        const str = JSON.stringify(u).toLowerCase();
        return str.includes('bhaumik') || str.includes('pranshu') || str.includes('f1f') || str.includes('2a3') || str.includes('kfa-2024');
    });
    console.log('Matching records:', JSON.stringify(matches, null, 2));

    // Cleanup temp user
    await client.from('users').delete().eq('id', signInData.user.id);
}

run();
