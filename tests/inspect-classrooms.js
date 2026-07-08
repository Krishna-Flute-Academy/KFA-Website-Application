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

const publicUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const publicAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseAuth = createClient(url, anonKey);
const supabasePublic = createClient(publicUrl, publicAnonKey);

async function inspectClassrooms() {
    console.log('--- AUTH DATABASE ---');
    console.log('Fetching classrooms from auth database:', url);
    const { data: authClassrooms, error: authError } = await supabaseAuth
        .from('classrooms')
        .select('id, name, is_live, live_meeting_link, live_session_started_at, teacher_id');

    if (authError) {
        console.error('Error fetching from auth database:', authError);
    } else {
        console.log(`Found ${authClassrooms?.length || 0} classroom(s).`);
        console.log(JSON.stringify(authClassrooms, null, 2));
    }

    console.log('\n--- PUBLIC DATABASE ---');
    console.log('Fetching classrooms from public database:', publicUrl);
    try {
        const { data: publicClassrooms, error: publicError } = await supabasePublic
            .from('classrooms')
            .select('id, name, is_live, live_meeting_link, live_session_started_at, teacher_id');

        if (publicError) {
            console.error('Error fetching from public database:', publicError);
        } else {
            console.log(`Found ${publicClassrooms?.length || 0} classroom(s).`);
            console.log(JSON.stringify(publicClassrooms, null, 2));
        }
    } catch (e) {
        console.error('Failed to query public database:', e);
    }
}

inspectClassrooms();
