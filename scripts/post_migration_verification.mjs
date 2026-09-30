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

async function runVerification() {
    console.log('======================================================================');
    console.log('STARTING LIVE POST-MIGRATION VERIFICATION');
    console.log('======================================================================\n');

    const snapshot = JSON.parse(fs.readFileSync('scratch/pre_migration_attendance_snapshot.json', 'utf8'));
    const { data: classrooms } = await client.from('classrooms').select('id, name');
    const classMap = new Map((classrooms || []).map(c => [c.id, c.name]));

    // ------------------------------------------------------------------
    // 1. Verify all 22 deterministic rows
    // ------------------------------------------------------------------
    console.log('--- 1. VERIFYING ALL 22 DETERMINISTIC ATTENDANCE ROWS ---');
    let all22Pass = true;
    const rowResults = [];

    for (const snap of snapshot) {
        const { data: row, error } = await client.from('attendance')
            .select('*')
            .eq('id', snap.attendance_id)
            .single();

        if (error || !row) {
            console.error(`❌ Could not fetch row ${snap.attendance_id}:`, error);
            all22Pass = false;
            continue;
        }

        const cidMatch = row.classroom_id === snap.target_historical_classroom_id;
        const dateMatch = row.date === snap.date;
        const statusMatch = row.status === snap.status;
        const oboMatch = (row.on_behalf_of_date || null) === (snap.on_behalf_of_date || null);
        const studentMatch = row.student_id === snap.student_id;

        const passed = cidMatch && dateMatch && statusMatch && oboMatch && studentMatch;
        if (!passed) all22Pass = false;

        rowResults.push({
            student_name: snap.student_name,
            date: snap.date,
            status: row.status,
            obo: row.on_behalf_of_date,
            before_cid: snap.current_classroom_id,
            after_cid: row.classroom_id,
            target_cid: snap.target_historical_classroom_id,
            target_name: snap.target_historical_classroom_name,
            resolved_name: classMap.get(row.classroom_id),
            cidMatch,
            dateMatch,
            statusMatch,
            oboMatch,
            passed
        });
    }

    console.log(`22 Rows Checked. All 22 point to verified historical classrooms: ${all22Pass ? 'PASS ✅' : 'FAIL ❌'}`);
    rowResults.forEach(r => {
        console.log(`  ${r.passed ? '✅' : '❌'} ${r.student_name.padEnd(20)} | ${r.date} | ${r.status.padEnd(7)} | before: "${classMap.get(r.before_cid)}" -> now: "${r.resolved_name}"`);
    });

    // ------------------------------------------------------------------
    // 2. Verify Selva Kumar specifically
    // ------------------------------------------------------------------
    console.log('\n--- 2. VERIFYING SELVA KUMAR SPECIFICALLY ---');
    const selvaId = 'ddfca297-8cd1-468d-a546-0e64cad35af7';
    const { data: selvaRows } = await client.from('attendance')
        .select('*')
        .eq('student_id', selvaId)
        .order('date');

    console.log(`Selva Kumar Total Attendance Records: ${selvaRows?.length || 0}`);
    let selvaPass = true;
    (selvaRows || []).forEach(r => {
        const cName = classMap.get(r.classroom_id);
        const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(r.date + 'T00:00:00Z').getUTCDay()];
        let expectedClass = '';
        if (['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22', '2026-08-29', '2026-09-05', '2026-09-19', '2026-09-26'].includes(r.date)) {
            expectedClass = 'Saturday Slot 4 (Offline - 11 AM)';
        } else if (['2026-09-01', '2026-09-29'].includes(r.date)) {
            expectedClass = 'Tuesday Slot 3 (Online - 7:30 PM)';
        }
        const matches = cName === expectedClass;
        if (!matches) selvaPass = false;
        console.log(`  ${matches ? '✅' : '❌'} ${r.date} (${dow}) | ${r.status.padEnd(7)} | ${cName} (Expected: ${expectedClass})`);
    });
    console.log(`Selva Kumar Verification: ${selvaPass ? 'PASS ✅' : 'FAIL ❌'}`);

    // ------------------------------------------------------------------
    // 3. Confirm 4 ambiguous rows remain completely untouched
    // ------------------------------------------------------------------
    console.log('\n--- 3. CONFIRMING 4 AMBIGUOUS ROWS REMAIN UNTOUCHED ---');
    const ambiguousTargets = [
        { name: 'Akshaghna S', student_id: '12bdf3b1-08b7-4bed-b8d7-58b239e64102', date: '2026-08-07', expected_cid: 'f718b29c-4124-4d07-a0be-5851fdbf3df0' },
        { name: 'Akshaghna S', student_id: '12bdf3b1-08b7-4bed-b8d7-58b239e64102', date: '2026-08-14', expected_cid: 'f718b29c-4124-4d07-a0be-5851fdbf3df0' },
        { name: 'anurag rai', student_id: 'fd0adc45-a947-45c9-8c6e-497eb6f8efbf', date: '2026-09-04', expected_cid: 'fbc35d29-812e-49b1-be04-8373efe47cac' },
        { name: 'Pranshu', student_id: '2a31496d-e59f-4b66-9309-95164afc7078', date: '2026-08-07', expected_cid: 'b6495cac-5cee-4bf8-828e-5eaa5582da02' }
    ];

    let ambiguousPass = true;
    for (const amb of ambiguousTargets) {
        const { data: row } = await client.from('attendance')
            .select('*')
            .eq('student_id', amb.student_id)
            .eq('date', amb.date)
            .single();

        const untouched = row?.classroom_id === amb.expected_cid;
        if (!untouched) ambiguousPass = false;
        console.log(`  ${untouched ? '✅ UNTOUCHED' : '❌ MODIFIED'} ${amb.name.padEnd(15)} | ${amb.date} | cid: "${classMap.get(row?.classroom_id)}" (${row?.classroom_id})`);
    }
    console.log(`Ambiguous Rows Integrity: ${ambiguousPass ? 'PASS ✅' : 'FAIL ❌'}`);

    // ------------------------------------------------------------------
    // 4. Live Transfer Test: Prove Classroom A -> B no longer mutates attendance
    // ------------------------------------------------------------------
    console.log('\n--- 4. LIVE DATABASE TRANSFER TEST (EMPIRICAL PROOF) ---');
    const testUserId = '479bb04d-0635-46db-8b13-c4f07421ae75';
    const classA = '862a3806-13e8-420b-8272-04a71fc5a435'; // Saturday Slot 10
    const classB = '83f78aff-f957-4c2e-9b91-2f29b10ad16b'; // Saturday Slot 12

    let triggerTransferPass = false;
    try {
        // Enroll in Class A
        await client.from('classroom_students').insert({
            student_id: testUserId,
            classroom_id: classA,
            joined_at: new Date().toISOString()
        });

        // Insert test attendance in Class A
        const { data: attRow, error: attInsertErr } = await client.from('attendance').insert({
            student_id: testUserId,
            classroom_id: classA,
            date: '2026-08-01',
            status: 'present'
        }).select().single();

        if (attInsertErr || !attRow) {
            console.error('  Failed to insert test attendance:', attInsertErr?.message);
        } else {
            console.log(`  Created test attendance in Class A ("${classMap.get(classA)}"): ${attRow.id}`);

            // Shift student to Class B (delete + insert in classroom_students)
            await client.from('classroom_students').delete().eq('student_id', testUserId);
            await client.from('classroom_students').insert({
                student_id: testUserId,
                classroom_id: classB,
                joined_at: new Date().toISOString()
            });

            // Verify attendance record
            const { data: attAfter } = await client.from('attendance').select('*').eq('id', attRow.id).single();
            console.log(`  Attendance classroom_id AFTER transfer to Class B: "${classMap.get(attAfter?.classroom_id)}" (${attAfter?.classroom_id})`);

            triggerTransferPass = (attAfter?.classroom_id === classA);
            console.log(`  Transfer Trigger Inactivity Check: ${triggerTransferPass ? 'PASS ✅ (Old attendance remained in Class A)' : 'FAIL ❌ (Old attendance mutated)'}`);
        }
    } finally {
        await client.from('attendance').delete().eq('student_id', testUserId);
        await client.from('classroom_students').delete().eq('student_id', testUserId);
        console.log('  Test user cleanup completed.');
    }

    // ------------------------------------------------------------------
    // 5. Total Attendance Row Count Check
    // ------------------------------------------------------------------
    console.log('\n--- 5. TOTAL ATTENDANCE ROW COUNT CHECK ---');
    const { count: totalCount } = await client.from('attendance').select('*', { count: 'exact', head: true });
    console.log(`Total Attendance Rows: ${totalCount} (Baseline pre-migration: 553)`);
    const countPass = totalCount === 553;
    console.log(`Row Count Check: ${countPass ? 'PASS ✅' : 'FAIL ❌'}`);

    console.log('\n======================================================================');
    console.log(`OVERALL RESULT: Historical attendance is now immutable across classroom transfers: ${all22Pass && selvaPass && ambiguousPass && triggerTransferPass && countPass ? 'PASS' : 'FAIL'}`);
    console.log('======================================================================');
}

runVerification().catch(console.error);
