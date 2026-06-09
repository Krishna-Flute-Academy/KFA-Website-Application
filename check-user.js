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

const supabase = createClient(url, anonKey);

async function checkUser() {
    const email = 'aditya.verma@example.com';
    console.log(`Checking public.users for email: ${email}`);
    
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email);

    if (error) {
        console.error('Error fetching user:', error);
    } else {
        console.log(`Found ${data.length} row(s) for ${email}:`);
        console.log(JSON.stringify(data, null, 2));
    }
}

checkUser();
