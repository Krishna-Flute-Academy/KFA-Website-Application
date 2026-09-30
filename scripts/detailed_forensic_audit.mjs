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

async function main() {
    const { data: users } = await client.from('users').select('id, name, created_at, role, status');
    const userMap = new Map((users || []).map(u => [u.id, u]));

    const { data: classrooms } = await client.from('classrooms').select('id, name, type');
    const classMap = new Map((classrooms || []).map(c => [c.id, c.name]));

    const { data: schedules } = await client.from('batch_schedules').select('*');
    const schedMap = new Map();
    (schedules || []).forEach(s => {
        if (!schedMap.has(s.classroom_id)) schedMap.set(s.classroom_id, []);
        schedMap.get(s.classroom_id).push(s.day_of_week);
    });

    const { data: enrollments } = await client.from('classroom_students').select('*');
    const enrollMap = new Map();
    (enrollments || []).forEach(e => {
        if (!enrollMap.has(e.student_id)) enrollMap.set(e.student_id, []);
        enrollMap.get(e.student_id).push(e);
    });

    const { data: att } = await client.from('attendance').select('*').order('date');
    const { data: notifs } = await client.from('notifications').select('*');
    const { data: sessionLogs } = await client.from('classroom_session_logs').select('*');
    const { data: overrides } = await client.from('session_student_overrides').select('*');

    console.log('=== AUDIT METRICS ===');
    console.log('Total Attendance Rows:', att.length);
    console.log('Total Notifications:', notifs?.length);
    console.log('Total Classroom Students:', enrollments?.length);

    // 1. Identify which students have attendance rows with day-of-week mismatch
    const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dowMismatches = [];

    att.forEach(a => {
        const validDows = schedMap.get(a.classroom_id) || [];
        const dow = new Date(a.date + 'T00:00:00Z').getUTCDay();
        if (validDows.length > 0 && !validDows.includes(dow)) {
            dowMismatches.push({
                attendance_id: a.id,
                student_id: a.student_id,
                student_name: userMap.get(a.student_id)?.name || 'Unknown',
                date: a.date,
                dow: dowNames[dow],
                classroom_id: a.classroom_id,
                classroom_name: classMap.get(a.classroom_id),
                status: a.status,
                on_behalf_of: a.on_behalf_of_date
            });
        }
    });

    console.log(`\n=== 1. DAY-OF-WEEK MISMATCHES (${dowMismatches.length} rows) ===`);
    const dowGrouped = new Map();
    dowMismatches.forEach(d => {
        if (!dowGrouped.has(d.student_id)) dowGrouped.set(d.student_id, []);
        dowGrouped.get(d.student_id).push(d);
    });

    for (const [sId, rows] of dowGrouped.entries()) {
        const student = userMap.get(sId);
        const currEnrolls = enrollMap.get(sId) || [];
        console.log(`\nStudent: ${student?.name} (${sId})`);
        console.log(`Current Enrollments:`, currEnrolls.map(e => `${classMap.get(e.classroom_id)} (joined: ${e.joined_at})`));
        console.log(`Mismatched Attendance Rows (${rows.length}):`);
        rows.forEach(r => {
            console.log(`  - ID: ${r.attendance_id} | Date: ${r.date} (${r.dow}) | Status: ${r.status} | Assigned Class: "${r.classroom_name}" | on_behalf_of: ${r.on_behalf_of || 'none'}`);
        });
    }

    // 2. Identify students with multiple classroom_students rows or students who transferred
    // Check if any student has joined_at much later than their account creation, indicating they were re-added to a new classroom
    console.log(`\n=== 2. INVESTIGATING ALL TRANSFERRED STUDENTS ===`);
    // Let's check which students have attendance rows under a classroom where they are NOT enrolled today
    const attInNonEnrolledClass = [];
    att.forEach(a => {
        const currEnrolls = enrollMap.get(a.student_id) || [];
        const isEnrolled = currEnrolls.some(e => e.classroom_id === a.classroom_id);
        if (!isEnrolled) {
            attInNonEnrolledClass.push({
                attendance_id: a.id,
                student_id: a.student_id,
                student_name: userMap.get(a.student_id)?.name || 'Unknown',
                date: a.date,
                classroom_id: a.classroom_id,
                classroom_name: classMap.get(a.classroom_id)
            });
        }
    });
    console.log(`Attendance rows in classrooms where student is NOT currently enrolled: ${attInNonEnrolledClass.length}`);
    if (attInNonEnrolledClass.length > 0) {
        console.log('Sample non-enrolled attendance rows:', attInNonEnrolledClass.slice(0, 10));
    }

    // 3. Check notifications for historical classroom evidence
    console.log(`\n=== 3. NOTIFICATIONS AUDIT FOR HISTORICAL CLASSROOM NAMES ===`);
    // Check how many notifications contain classroom names
    const classNotifs = (notifs || []).filter(n => 
        (n.title && (n.title.includes('Class Started') || n.title.includes('Attendance'))) ||
        (n.message && (n.message.includes('attendance for') || n.message.includes('class session for') || n.message.includes('online class for')))
    );
    console.log(`Total class/attendance related notifications: ${classNotifs.length}`);
    
    // Group class notifications by user_id
    const notifsByUser = new Map();
    classNotifs.forEach(n => {
        if (!notifsByUser.has(n.user_id)) notifsByUser.set(n.user_id, []);
        notifsByUser.get(n.user_id).push(n);
    });

    console.log(`Users with class notifications: ${notifsByUser.size}`);

    // Specifically print notifications for students with DOW mismatches
    for (const sId of dowGrouped.keys()) {
        const userNotifs = notifsByUser.get(sId) || [];
        console.log(`\nNotifications for student ${userMap.get(sId)?.name}: (${userNotifs.length} notifications)`);
        userNotifs.forEach(n => {
            console.log(`  [${n.created_at}] [${n.type}] ${n.title} -> ${n.message}`);
        });
    }

    // 4. Trace the 178 "attendance date < joined_at" rows
    console.log(`\n=== 4. ANALYZING THE 178 "date < joined_at" ROWS ===`);
    // Why did 68 students have date < joined_at?
    // Let's check joined_at distribution
    const joinDates = new Map();
    enrollments.forEach(e => {
        const d = e.joined_at ? e.joined_at.split('T')[0] : 'null';
        joinDates.set(d, (joinDates.get(d) || 0) + 1);
    });
    console.log('Classroom_students joined_at date breakdown:');
    for (const [d, count] of [...joinDates.entries()].sort()) {
        console.log(`  ${d}: ${count} enrollments`);
    }
}

main().catch(console.error);
