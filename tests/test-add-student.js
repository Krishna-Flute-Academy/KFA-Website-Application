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

async function testFetch() {
    console.log('Trying to fetch users...');
    const { data: users, error: usersError } = await supabaseAuth
        .from('users')
        .select('*')
        .limit(5);

    if (usersError) {
        console.error('Users fetch error:', usersError);
    } else {
        console.log('Successfully fetched users:', users);
    }

    console.log('Trying to fetch classrooms...');
    const { data: rooms, error: roomsError } = await supabaseAuth
        .from('classrooms')
        .select('*')
        .limit(5);

    if (roomsError) {
        console.error('Classrooms fetch error:', roomsError);
    } else {
        console.log('Successfully fetched classrooms:', rooms);
    }
}

testFetch();
