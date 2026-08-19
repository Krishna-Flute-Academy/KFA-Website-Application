const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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
const supabase = createClient(url, anonKey);

async function inspect() {
    console.log('Testing authentication...');
    const testEmail = 'inspect_' + Date.now() + '@gmail.com';
    const testPass = 'Password123!';
    
    // 1. Sign up test user
    const { data: signUpData, error: sErr } = await supabase.auth.signUp({
        email: testEmail,
        password: testPass,
        options: { data: { full_name: 'Inspector', role: 'teacher' } }
    });

    if (sErr) {
        console.error('SignUp error:', sErr);
        return;
    }

    console.log('User signed up. ID:', signUpData.user?.id);

    // 2. Sign in
    const { data: signInData, error: iErr } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPass
    });

    if (iErr) {
        console.error('SignIn error:', iErr);
        return;
    }

    const token = signInData.session?.access_token;
    console.log('Signed in! Token acquired.');

    const authClient = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Fetch all users
    const { data: users, error: uErr } = await authClient.from('users').select('*');
    if (uErr) {
        console.error('Fetch users error:', uErr);
        return;
    }

    console.log(`Successfully fetched ${users.length} users from public.users!`);

    console.log('\n========================================');
    console.log('LOOKING FOR TARGET USERS:');
    console.log('========================================');

    // Search for Bhaumik & Pranshu
    const targets = users.filter(u => {
        const uId = (u.id || '').toLowerCase();
        const uEmail = (u.email || '').toLowerCase();
        const uName = (u.name || '').toLowerCase();
        return uId.startsWith('f1f') || 
               uId.startsWith('2a3') || 
               uEmail.includes('bhaumik') || 
               uEmail.includes('pranshu') || 
               uName.includes('bhaumik') || 
               uName.includes('pranshu');
    });

    if (targets.length === 0) {
        console.log('No matching users found for Bhaumik / Pranshu / f1f... / 2a3...');
    } else {
        targets.forEach(u => {
            console.log('\nUser Found:');
            console.log('  ID:', u.id);
            console.log('  Name:', u.name);
            console.log('  Email:', u.email);
            console.log('  Role:', u.role);
            console.log('  Status:', u.status);
            console.log('  Level:', u.level);
            console.log('  Teacher ID:', u.teacher_id);
            console.log('  Join Date:', u.join_date);
            console.log('  Full record:', JSON.stringify(u, null, 2));
        });
    }

    console.log('\n========================================');
    console.log('SUMMARY OF ALL USER ROLES AND STATUSES:');
    console.log('========================================');
    users.forEach(u => {
        console.log(`[${u.id.substring(0, 8)}] ${u.email} | Name: "${u.name}" | Role: "${u.role}" | Status: "${u.status}"`);
    });

    // Clean up test user
    if (signInData.user?.id) {
        await authClient.from('users').delete().eq('id', signInData.user.id);
    }
}

inspect().catch(console.error);
