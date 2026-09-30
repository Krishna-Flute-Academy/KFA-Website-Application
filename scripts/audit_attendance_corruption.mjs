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

const tokenObj = JSON.parse(fs.readFileSync('scratch/user_token.json', 'utf8'));
const token = tokenObj.access_token;

const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
});

async function runAudit() {
    console.log('=== RUNNING DATABASE-WIDE ATTENDANCE AUDIT WITH AUTHENTICATED SESSION ===');

    console.log('=== STEP 1: CLASSROOMS & BATCH SCHEDULES ===');
    const { data: classrooms } = await client.from('classrooms').select('id, name, type');
    const classroomMap = new Map();
    (classrooms || []).forEach(c => classroomMap.set(c.id, c.name));
    console.log(`Loaded ${classrooms?.length || 0} classrooms.`);

    const { data: schedules } = await client.from('batch_schedules').select('classroom_id, day_of_week, start_time, end_time');
    const scheduleByClass = new Map();
    (schedules || []).forEach(s => {
        if (!scheduleByClass.has(s.classroom_id)) scheduleByClass.set(s.classroom_id, []);
        scheduleByClass.get(s.classroom_id).push(s);
    });

    console.log('\n=== STEP 2: SEARCHING FOR SELVA KUMAR ===');
    const { data: selvaUsers } = await client.from('users').select('*').ilike('name', '%Selva%');
    console.log(`Found ${selvaUsers?.length || 0} user(s) matching 'Selva':`);

    if (selvaUsers && selvaUsers.length > 0) {
        for (const u of selvaUsers) {
            console.log(`\nSelva: ${u.name} (id: ${u.id}, status: ${u.status}, join_date: ${u.join_date})`);
            
            // Classroom_students
            const { data: enrollments } = await client.from('classroom_students').select('*').eq('student_id', u.id);
            console.log('classroom_students enrollment(s):', enrollments?.map(e => ({
                classroom_id: e.classroom_id,
                classroom_name: classroomMap.get(e.classroom_id),
                joined_at: e.joined_at
            })));

            // Attendance rows
            const { data: attRecords } = await client.from('attendance').select('*').eq('student_id', u.id).order('date', { ascending: true });
            console.log(`Attendance records (${attRecords?.length || 0}):`);
            const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            (attRecords || []).forEach(a => {
                const dow = new Date(a.date).getDay();
                console.log(`  Date: ${a.date} (${dows[dow]}) | classroom_id: ${a.classroom_id} ("${classroomMap.get(a.classroom_id)}") | status: ${a.status} | on_behalf_of: ${a.on_behalf_of_date || 'null'}`);
            });

            // Notifications
            const { data: notifs } = await client.from('notifications')
                .select('*')
                .eq('user_id', u.id)
                .order('created_at', { ascending: true });
            console.log(`Notifications (${notifs?.length || 0}):`);
            (notifs || []).forEach(n => {
                console.log(`  [${n.created_at}] [${n.type}] ${n.title} -> ${n.message}`);
            });

            // Overrides
            const { data: ovs } = await client.from('session_student_overrides').select('*').eq('student_id', u.id);
            console.log(`Overrides (${ovs?.length || 0}):`, ovs);
        }
    }

    console.log('\n=== STEP 3: DATABASE-WIDE AUDIT FOR ALL TRANSFERS & ATTENDANCE ===');
    const { data: allUsers } = await client.from('users').select('id, name, role, status').in('role', ['student', 'pending', 'mentor']);
    const userMap = new Map();
    (allUsers || []).forEach(u => userMap.set(u.id, u.name));
    console.log(`Total students in users table: ${allUsers?.length || 0}`);

    const { data: allEnrollments } = await client.from('classroom_students').select('*');
    console.log(`Total classroom_students rows: ${allEnrollments?.length || 0}`);

    const enrollmentByStudent = new Map();
    (allEnrollments || []).forEach(e => {
        if (!enrollmentByStudent.has(e.student_id)) enrollmentByStudent.set(e.student_id, []);
        enrollmentByStudent.get(e.student_id).push(e);
    });

    const { data: allAtt } = await client.from('attendance').select('*').order('date', { ascending: true });
    console.log(`Total attendance records across all students: ${allAtt?.length || 0}`);

    // Track anomalies
    const affectedStudents = new Map(); // student_id -> { name, anomalousRows: [] }

    (allAtt || []).forEach(att => {
        const studentEnrollments = enrollmentByStudent.get(att.student_id) || [];
        const enrolledClassroom = studentEnrollments.find(e => e.classroom_id === att.classroom_id);
        const scheds = scheduleByClass.get(att.classroom_id) || [];
        const dow = new Date(att.date).getDay();
        const dowMatches = scheds.some(s => s.day_of_week === dow);

        const reasons = [];

        // Check 1: Attendance date is before joined_at of current classroom
        if (enrolledClassroom && enrolledClassroom.joined_at) {
            const joinDateStr = enrolledClassroom.joined_at.split('T')[0];
            if (att.date < joinDateStr) {
                reasons.push(`attendance date (${att.date}) < joined_at (${joinDateStr})`);
            }
        }

        // Check 2: Day of week does not match the assigned classroom's scheduled day of week
        if (scheds.length > 0 && !dowMatches) {
            const validDows = scheds.map(s => s.day_of_week).join(',');
            const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            reasons.push(`date is ${dows[dow]} (dow ${dow}), but classroom ${classroomMap.get(att.classroom_id)} is scheduled on dow [${validDows}]`);
        }

        if (reasons.length > 0) {
            if (!affectedStudents.has(att.student_id)) {
                affectedStudents.set(att.student_id, {
                    studentId: att.student_id,
                    studentName: userMap.get(att.student_id) || 'Unknown',
                    enrollments: studentEnrollments.map(e => ({
                        classroom_id: e.classroom_id,
                        classroom_name: classroomMap.get(e.classroom_id),
                        joined_at: e.joined_at
                    })),
                    records: []
                });
            }
            affectedStudents.get(att.student_id).records.push({
                attendanceId: att.id,
                date: att.date,
                status: att.status,
                on_behalf_of_date: att.on_behalf_of_date,
                classroom_id: att.classroom_id,
                classroom_name: classroomMap.get(att.classroom_id),
                reasons
            });
        }
    });

    console.log(`\n=== AUDIT RESULTS SUMMARY ===`);
    console.log(`Total students audited: ${allUsers?.length || 0}`);
    console.log(`Students with anomalous/corrupted attendance rows: ${affectedStudents.size}`);

    let totalAnomalousRows = 0;
    for (const [sId, info] of affectedStudents.entries()) {
        totalAnomalousRows += info.records.length;
        console.log(`\n--------------------------------------------------`);
        console.log(`Student: ${info.studentName} (${sId})`);
        console.log(`Current Enrollments:`, JSON.stringify(info.enrollments));
        console.log(`Anomalous Records Count: ${info.records.length}`);
        info.records.forEach(r => {
            console.log(`  - Date: ${r.date} | Status: ${r.status} | on_behalf_of: ${r.on_behalf_of_date || 'none'} | Classroom: "${r.classroom_name}" (${r.classroom_id})`);
            console.log(`    Anomaly: ${r.reasons.join(' | ')}`);
        });
    }
    console.log(`\nTotal anomalous attendance rows found: ${totalAnomalousRows}`);

    // Check classroom_session_logs
    const { data: sessionLogs } = await client.from('classroom_session_logs').select('*').order('session_date', { ascending: false }).limit(30);
    console.log(`\nClassroom session logs count: ${sessionLogs?.length || 0}`);
    (sessionLogs || []).forEach(sl => {
        console.log(`  Log: ${sl.session_date} | classroom: ${classroomMap.get(sl.classroom_id)} (${sl.classroom_id}) | present: ${sl.present_count}, absent: ${sl.absent_count}`);
    });

    console.log('\n=== AUDIT COMPLETE ===');
}

runAudit().catch(console.error);
