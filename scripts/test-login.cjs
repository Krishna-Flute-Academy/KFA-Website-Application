const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = './.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    }
});

const authSupabase = createClient(env.NEXT_PUBLIC_AUTH_SUPABASE_URL, env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY);

async function testEmails() {
    const emails = ['kgbhaumik86@gmail.com', 'bhaumikg1986@gmail.com', 'krishnagopalbhaumik@gmail.com'];
    
    for (const em of emails) {
        console.log(`\nChecking email: ${em}`);
        const { data, error } = await authSupabase
            .from('users')
            .select('id, name, email, role, status')
            .ilike('email', `%${em}%`);
        console.log('Query result:', data, error?.message || '');

        const { data: signRes, error: signErr } = await authSupabase.auth.signInWithPassword({
            email: em,
            password: 'invalid_probe_password'
        });
        console.log('Auth check for ' + em + ':', signErr?.message);
    }
}

testEmails();
