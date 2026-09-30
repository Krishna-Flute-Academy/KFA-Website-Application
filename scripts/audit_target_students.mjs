import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const tokenObj = JSON.parse(fs.readFileSync('scratch/user_token.json', 'utf8'));
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
});

const client = createClient(env.NEXT_PUBLIC_AUTH_SUPABASE_URL, env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${tokenObj.access_token}` } }
});

const targetStudents = [
    { name: 'Selva Kumar', id: 'ddfca297-8cd1-468d-a546-0e64cad35af7' },
    { name: 'Trisha Das', id: '9893770a-6806-4a80-ba5d-de6f43e994b3' },
    { name: 'Pranshu', id: '2a31496d-e59f-4b66-9309-95164afc7078' },
    { name: 'Akshaghna S', id: '12bdf3b1-08b7-4bed-b8d7-58b239e64102' },
    { name: 'Hrishikesh Deodhar', id: '96c92402-e649-485f-9b18-7e0559d26f2f' },
    { name: 'Samika Krishna', id: 'e2c88351-61aa-423d-910b-54ea640e660c' },
    { name: 'Bhaumikg', id: 'f1f472e0-3327-4d60-a97a-ad7e36916a4e' },
    { name: 'Shriya Kamath', id: '8dc52f3e-11a7-4d4f-a582-7183a9459078' },
    { name: 'anurag rai', id: 'fd0adc45-a947-45c9-8c6e-497eb6f8efbf' }
];

async function inspectStudent(s) {
    console.log(`\n======================================================================`);
    console.log(`STUDENT: ${s.name} (${s.id})`);
    console.log(`======================================================================`);

    // 1. Current Enrollment
    const { data: enrolls } = await client.from('classroom_students').select('*, classrooms(name, type)').eq('student_id', s.id);
    console.log('Current Enrollment:', enrolls?.map(e => ({
        classroom_id: e.classroom_id,
        classroom_name: e.classrooms?.name,
        type: e.classrooms?.type,
        joined_at: e.joined_at
    })));

    // 2. Attendance rows
    const { data: att } = await client.from('attendance').select('*, classrooms(name)').eq('student_id', s.id).order('date');
    console.log(`\nAttendance Rows (${att?.length || 0}):`);
    att?.forEach(a => {
        const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(a.date + 'T00:00:00Z').getUTCDay()];
        console.log(`  ${a.date} (${dow}) | status: ${a.status} | on_behalf_of: ${a.on_behalf_of_date || 'none'} | classroom: "${a.classrooms?.name}" (${a.classroom_id})`);
    });

    // 3. User notifications
    const { data: notifs } = await client.from('notifications').select('*').eq('user_id', s.id).order('created_at');
    const classNotifs = (notifs || []).filter(n => 
        (n.title && (n.title.includes('Class') || n.title.includes('Attendance') || n.title.includes('Task'))) ||
        (n.message && (n.message.includes('class session') || n.message.includes('online class') || n.message.includes('attendance for')))
    );
    console.log(`\nRelevant Notifications (${classNotifs.length}):`);
    classNotifs.forEach(n => {
        console.log(`  [${n.created_at}] [${n.type}] ${n.title} -> ${n.message}`);
    });

    // 4. Overrides
    const { data: ovs } = await client.from('session_student_overrides').select('*, classrooms:target_classroom_id(name)').eq('student_id', s.id);
    console.log(`\nOverrides (${ovs?.length || 0}):`);
    ovs?.forEach(o => {
        console.log(`  Date: ${o.override_date} | Target: "${o.classrooms?.name}" (${o.target_classroom_id}) | Reason: ${o.reason} | Created: ${o.created_at}`);
    });
}

async function run() {
    for (const s of targetStudents) {
        await inspectStudent(s);
    }
}

run().catch(console.error);
