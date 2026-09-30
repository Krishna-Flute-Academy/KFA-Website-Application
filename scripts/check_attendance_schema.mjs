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

const url = env.NEXT_PUBLIC_AUTH_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(url, anonKey);

async function run() {
    // 1. Check columns of one attendance row
    const { data: sampleAtt } = await supabase.from('attendance').select('*').limit(1);
    console.log('Sample attendance row keys:', sampleAtt && sampleAtt[0] ? Object.keys(sampleAtt[0]) : 'None');

    // 2. List all users with student role or find anyone matching Selva or similar
    const { data: allUsers } = await supabase.from('users').select('id, name, email, role, status').order('name');
    console.log(`Total users in public.users: ${allUsers?.length || 0}`);
    const selva = allUsers?.filter(u => u.name && u.name.toLowerCase().includes('selva'));
    console.log('Users matching "selva":', selva);

    // If no selva, let's search for "kumar"
    const kumar = allUsers?.filter(u => u.name && u.name.toLowerCase().includes('kumar'));
    console.log('Users matching "kumar":', kumar);
}

run().catch(console.error);
