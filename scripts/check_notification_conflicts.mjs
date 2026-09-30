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

async function checkSameDowTransfers() {
    const { data: users } = await client.from('users').select('id, name');
    const userMap = new Map((users || []).map(u => [u.id, u.name]));

    const { data: classrooms } = await client.from('classrooms').select('id, name');
    const classMap = new Map((classrooms || []).map(c => [c.id, c.name]));

    // Fetch all attendance records once
    const { data: allAtt } = await client.from('attendance').select('*');
    const attMap = new Map(); // key: student_id:date -> array of attendance rows
    (allAtt || []).forEach(a => {
        const key = `${a.student_id}:${a.date}`;
        if (!attMap.has(key)) attMap.set(key, []);
        attMap.get(key).push(a);
    });

    // Check all notifications of type 'live_class' or containing 'Class Started'
    const { data: notifs } = await client.from('notifications')
        .select('*')
        .or('type.eq.live_class,title.ilike.%Class Started%,message.ilike.%class session for%');

    console.log(`Auditing ${notifs?.length || 0} notifications against ${allAtt?.length || 0} attendance records in-memory...`);

    const mismatches = [];

    for (const n of (notifs || [])) {
        if (!n.created_at || !n.user_id) continue;
        const dateStr = n.created_at.split('T')[0];
        
        let mentionedClass = null;
        const m = n.message?.match(/for \"([^\"]+)\"/) || n.title?.match(/Class Started: (.+)/);
        if (m) mentionedClass = m[1].trim();

        if (!mentionedClass) continue;

        const attRows = attMap.get(`${n.user_id}:${dateStr}`) || [];
        for (const a of attRows) {
            const attClassName = classMap.get(a.classroom_id);
            if (attClassName && mentionedClass !== attClassName && !mentionedClass.includes('Temp') && !attClassName.includes('Temp')) {
                mismatches.push({
                    student_id: n.user_id,
                    student_name: userMap.get(n.user_id),
                    date: dateStr,
                    notification_time: n.created_at,
                    notification_classroom: mentionedClass,
                    attendance_classroom: attClassName,
                    attendance_id: a.id
                });
            }
        }
    }

    console.log(`\n=== NOTIFICATION VS ATTENDANCE CLASSROOM MISMATCHES (${mismatches.length} found) ===`);
    mismatches.forEach(m => {
        console.log(`Student: ${m.student_name} (${m.student_id}) | Date: ${m.date}`);
        console.log(`  Notification stated: "${m.notification_classroom}"`);
        console.log(`  Attendance row has:  "${m.attendance_classroom}" (${m.attendance_id})`);
    });
}

checkSameDowTransfers().catch(console.error);
