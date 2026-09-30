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

async function checkSessions() {
    const students = [
        { name: 'Selva Kumar', id: 'ddfca297-8cd1-468d-a546-0e64cad35af7' },
        { name: 'Trisha Das', id: '9893770a-6806-4a80-ba5d-de6f43e994b3' },
        { name: 'Samika Krishna', id: 'e2c88351-61aa-423d-910b-54ea640e660c' },
        { name: 'Hrishikesh Deodhar', id: '96c92402-e649-485f-9b18-7e0559d26f2f' },
        { name: 'Akshaghna S', id: '12bdf3b1-08b7-4bed-b8d7-58b239e64102' },
        { name: 'anurag rai', id: 'fd0adc45-a947-45c9-8c6e-497eb6f8efbf' },
        { name: 'Pranshu', id: '2a31496d-e59f-4b66-9309-95164afc7078' }
    ];

    const { data: classrooms } = await client.from('classrooms').select('id, name');
    const classMap = new Map((classrooms || []).map(c => [c.id, c.name]));

    for (const s of students) {
        console.log(`\n======================================================`);
        console.log(`CHECKING SESSIONS & LOGS FOR: ${s.name}`);
        console.log(`======================================================`);

        const { data: att } = await client.from('attendance').select('*').eq('student_id', s.id).order('date');

        for (const a of (att || [])) {
            // Find all classroom_session_logs on this date
            const { data: logs } = await client.from('classroom_session_logs').select('*').eq('session_date', a.date);

            // Find all attendance records on this date
            const { data: otherAtt } = await client.from('attendance').select('classroom_id').eq('date', a.date);
            const classCounts = new Map();
            (otherAtt || []).forEach(oa => {
                classCounts.set(oa.classroom_id, (classCounts.get(oa.classroom_id) || 0) + 1);
            });

            console.log(`Date: ${a.date} | Status: ${a.status} | Current CID: "${classMap.get(a.classroom_id)}"`);
            if (logs && logs.length > 0) {
                const logStrs = logs.map(l => `${classMap.get(l.classroom_id)} (P:${l.present_count}, A:${l.absent_count})`);
                console.log(`   Session logs: ${logStrs.join('; ')}`);
            }
        }
    }
}

checkSessions().catch(console.error);
