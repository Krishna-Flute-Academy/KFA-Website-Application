import createJiti from 'jiti';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const jiti = createJiti(import.meta.url);
const { normalizeStudentAttendanceHistory } = jiti('../src/lib/student-attendance-history.ts');
const { getStudentFeeCycleLedger } = jiti('../src/lib/fee-utils.ts');
const { derivePendingAttendanceSessions } = jiti('../src/lib/attendance-pending.ts');

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

async function runCrossModuleValidation() {
    console.log('======================================================================');
    console.log('CROSS-MODULE VERIFICATION ACROSS HISTORICAL MODULES');
    console.log('======================================================================\n');

    const selvaId = 'ddfca297-8cd1-468d-a546-0e64cad35af7';
    const satSlot4Id = 'd56c216a-3518-4361-b323-e6845a298e8c';
    const tueSlot3Id = '3b9316e5-be0c-49a1-a429-b8dda8383104';

    // Fetch live data
    const [userRes, attRes, classRes, tempRes, ovRes, payRes, schedRes, csRes] = await Promise.all([
        client.from('users').select('*').eq('id', selvaId).single(),
        client.from('attendance').select('*').eq('student_id', selvaId).order('date'),
        client.from('classrooms').select('id, name, type'),
        client.from('temporary_classes').select('id, title, session_date'),
        client.from('session_student_overrides').select('*').eq('student_id', selvaId),
        client.from('fees_payments').select('*').eq('student_id', selvaId),
        client.from('batch_schedules').select('*'),
        client.from('classroom_students').select('student_id, classroom_id, joined_at').eq('student_id', selvaId)
    ]);

    const selva = userRes.data;
    const attList = attRes.data || [];
    const classrooms = classRes.data || [];
    const tempClasses = tempRes.data || [];
    const overrides = ovRes.data || [];
    const payments = payRes.data || [];
    const schedules = schedRes.data || [];
    const enrollments = csRes.data || [];

    // ------------------------------------------------------------------
    // Module 1: Full Attendance History (Student-Centric View)
    // ------------------------------------------------------------------
    console.log('--- 1. FULL ATTENDANCE HISTORY (Student-Centric View) ---');
    const historyResult = normalizeStudentAttendanceHistory({
        studentId: selvaId,
        attendance: attList,
        classrooms,
        temporaryClasses: tempClasses,
        overrides
    });

    console.log(`Total History Records: ${historyResult.records.length}`);
    let historyAllCorrect = true;
    historyResult.records.forEach(r => {
        console.log(`  Date: ${r.actualDate} | Scheduled: ${r.scheduledDate} | Status: ${r.status.padEnd(7)} | Classroom: "${r.classroomName}" | On-Behalf: ${r.isOnBehalf}`);
        if (['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22', '2026-08-29', '2026-09-05', '2026-09-19', '2026-09-26'].includes(r.actualDate)) {
            if (r.classroomName !== 'Saturday Slot 4 (Offline - 11 AM)') historyAllCorrect = false;
        } else if (['2026-09-01', '2026-09-29'].includes(r.actualDate)) {
            if (r.classroomName !== 'Tuesday Slot 3 (Online - 7:30 PM)') historyAllCorrect = false;
        }
    });
    console.log(`Full Attendance History Integrity: ${historyAllCorrect ? 'PASS ✅' : 'FAIL ❌'}`);

    // ------------------------------------------------------------------
    // Module 2: Fees Attendance View & Cycle Session Ledger
    // ------------------------------------------------------------------
    console.log('\n--- 2. CYCLE SESSION LEDGER & FEES ATTENDANCE VIEW ---');
    const currentClass = classrooms.find(c => c.id === tueSlot3Id);
    const previousClass = classrooms.find(c => c.id === satSlot4Id);

    const ledger = getStudentFeeCycleLedger({
        student: {
            ...selva,
            fees_basis: 'monthly',
            fees_collection_date: 1
        },
        referenceDate: '2026-09-30',
        classrooms: [
            { ...currentClass, joined_at: '2026-09-29T14:01:34.733Z' },
            { ...previousClass, joined_at: '2026-08-01T00:00:00.000Z' }
        ],
        batchSchedules: schedules,
        attendance: attList,
        payments
    });

    console.log(`Cycle Range: ${ledger.cycleStart} to ${ledger.nextDueDate}`);
    console.log(`Sessions Count: ${ledger.sessions.length}`);
    let ledgerIntegrity = true;
    ledger.sessions.forEach(s => {
        console.log(`  Session: ${s.date} (${s.dayName.padEnd(8)}) | Class: "${s.classroomName}" | Status: ${s.status}`);
        // Ensure Saturday dates show Saturday Slot 4
        if (['2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26'].includes(s.date)) {
            if (s.classroomName !== 'Saturday Slot 4 (Offline - 11 AM)') {
                ledgerIntegrity = false;
            }
        }
        // Ensure Tuesday dates show Tuesday Slot 3
        if (['2026-09-01', '2026-09-29'].includes(s.date)) {
            if (s.classroomName !== 'Tuesday Slot 3 (Online - 7:30 PM)') {
                ledgerIntegrity = false;
            }
        }
        // Ensure no phantom Tuesdays (08 Sep, 15 Sep, 22 Sep)
        if (['2026-09-08', '2026-09-15', '2026-09-22'].includes(s.date)) {
            ledgerIntegrity = false;
            console.error(`  ERROR: Phantom Tuesday reconstructed on ${s.date}!`);
        }
    });
    console.log(`Cycle Session Ledger Integrity: ${ledgerIntegrity ? 'PASS ✅' : 'FAIL ❌'}`);

    // ------------------------------------------------------------------
    // Module 3: Individual Range Report / Calendar View
    // ------------------------------------------------------------------
    console.log('\n--- 3. INDIVIDUAL RANGE REPORT / CALENDAR VIEW ---');
    // Simulate what Individual Range Report queries for Saturday Slot 4 on 2026-09-05
    const { data: satAttRows } = await client
        .from('attendance')
        .select('student_id, classroom_id, status, date')
        .eq('classroom_id', satSlot4Id)
        .eq('date', '2026-09-05');
    
    const selvaSatAtt = (satAttRows || []).find(r => r.student_id === selvaId);
    console.log(`  2026-09-05 (Saturday Slot 4): Found Selva attendance? ${!!selvaSatAtt} (Status: ${selvaSatAtt?.status})`);

    // Simulate query for Tuesday Slot 3 on 2026-09-05
    const { data: tueAttRows } = await client
        .from('attendance')
        .select('student_id, classroom_id, status, date')
        .eq('classroom_id', tueSlot3Id)
        .eq('date', '2026-09-05');
    const selvaTueCorrupted = (tueAttRows || []).find(r => r.student_id === selvaId);
    console.log(`  2026-09-05 (Tuesday Slot 3): Found Selva attendance erroneously? ${!!selvaTueCorrupted}`);

    const rangeReportPass = !!selvaSatAtt && !selvaTueCorrupted;
    console.log(`Individual Range Report Integrity: ${rangeReportPass ? 'PASS ✅' : 'FAIL ❌'}`);

    // ------------------------------------------------------------------
    // Module 4: Attendance Pending / Missed Classes Report
    // ------------------------------------------------------------------
    console.log('\n--- 4. ATTENDANCE PENDING / MISSED CLASSES CHECK ---');
    const pendingSessions = derivePendingAttendanceSessions({
        fromDate: '2026-09-01',
        toDate: '2026-09-30',
        classrooms,
        batchSchedules: schedules,
        temporaryClasses: tempClasses,
        permanentStudents: [
            {
                student_id: selvaId,
                classroom_id: tueSlot3Id,
                joined_at: '2026-09-29T14:01:34.733Z',
                users: selva
            }
        ],
        sessionOverrides: overrides,
        attendanceRows: attList,
        coveredAttendanceRows: attList.filter(a => !!a.on_behalf_of_date),
        referenceNow: new Date('2026-09-30T12:00:00Z')
    });

    // Check if Selva is erroneously flagged as pending for Tuesday Slot 3 on dates before 2026-09-29
    let pendingErr = false;
    pendingSessions.forEach(ps => {
        const selvaPending = ps.pendingStudents.find(s => s.studentId === selvaId);
        if (selvaPending && ps.date < '2026-09-29') {
            pendingErr = true;
            console.error(`  ERROR: Selva flagged pending on ${ps.date} in ${ps.classroomName} before transfer!`);
        }
    });
    console.log(`Attendance Pending (No false historical pendings): ${!pendingErr ? 'PASS ✅' : 'FAIL ❌'}`);

    console.log('\n======================================================================');
    const allPass = historyAllCorrect && ledgerIntegrity && rangeReportPass && !pendingErr;
    console.log(`ALL CROSS-MODULE CHECKS PASSED: ${allPass ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log('======================================================================');
}

runCrossModuleValidation().catch(console.error);
