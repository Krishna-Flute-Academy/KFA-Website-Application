import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Parse .env manually
const envContent = fs.readFileSync('./.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const url = env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;

console.log('Connecting to:', url);
const supabase = createClient(url, anonKey);

async function check() {
    console.log('--- 1. Searching for Pranshu in users ---');
    const { data: users, error: uErr } = await supabase
        .from('users')
        .select('id, name, email, role, teacher_id');
        
    // Filter locally to bypass RLS restrictions if it returned any rows,
    // or print the list if it's empty due to RLS.
    console.log('Total users fetched:', users?.length, 'Error:', uErr);
    
    // Let's query by matching name 'Pranshu' case-insensitively using ilike
    const { data: pranshuUsers, error: pErr } = await supabase
        .from('users')
        .select('id, name, email, role, teacher_id')
        .ilike('name', '%Pranshu%');
    console.log('Pranshu users found:', pranshuUsers);
    console.log('Error searching Pranshu:', pErr);

    if (!pranshuUsers || pranshuUsers.length === 0) {
        console.log('No user named Pranshu found. Let us list some classroom students to find his ID.');
        const { data: cs } = await supabase
            .from('classroom_students')
            .select('id, student_id, classroom_id')
            .limit(10);
        console.log('Classroom Students:', cs);
        return;
    }

    const pranshu = pranshuUsers[0];
    const studentId = pranshu.id;

    console.log('--- 2. Checking Classroom Students mapping for Pranshu ---');
    const { data: csMap, error: csErr } = await supabase
        .from('classroom_students')
        .select('id, classroom_id, student_id')
        .eq('student_id', studentId);
    console.log('Classroom students mapping:', csMap);
    console.log('Mapping error:', csErr);

    const classroomId = csMap && csMap.length > 0 ? csMap[0].classroom_id : null;

    console.log('--- 3. Checking all assignments in DB ---');
    const { data: allAsg, error: asgErr } = await supabase
        .from('assignments')
        .select('id, title, classroom_id, target_type, created_at');
    console.log('All Assignments in DB:', allAsg);
    console.log('Assignments Error:', asgErr);

    console.log('--- 4. Checking assignment_students mappings for Pranshu ---');
    const { data: saMap, error: saErr } = await supabase
        .from('assignment_students')
        .select('id, assignment_id, student_id, status, video_url')
        .eq('student_id', studentId);
    console.log('Assignment student mappings:', saMap);
    console.log('Mappings Error:', saErr);
}

check();
