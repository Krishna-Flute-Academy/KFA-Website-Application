const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = './.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const authSupabase = createClient(env.NEXT_PUBLIC_AUTH_SUPABASE_URL, env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY);

async function testUserFetch() {
    console.log('Testing session check and user fetch...');
    const email = 'bhaumikg1986@gmail.com';
    
    // Check if we can search users or login
    console.log(`Checking public.users for email: ${email}`);
    const { data: usersByEmail, error: err1 } = await authSupabase
        .from('users')
        .select('id, name, email, role, status')
        .ilike('email', email);

    console.log('By email result:', usersByEmail, err1);
}

testUserFetch();
