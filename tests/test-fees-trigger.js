import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sevtycwrmhzyfxvxkkgc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNldnR5Y3dybWh6eWZ4dnhra2djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNTI1OTgsImV4cCI6MjA4ODYyODU5OH0.2Xogmd7xqfXg2AUP9PTWisTtAn2SXsAJUWWYWYB-XNs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTrigger() {
    console.log('--- KFA Fees Trigger Test ---');

    // 1. Fetch a student to test with
    console.log('1. Fetching a student for test...');
    const { data: students, error: studentErr } = await supabase
        .from('users')
        .select('id, name, fees_classes_paid')
        .eq('role', 'student')
        .limit(1);

    if (studentErr) {
        console.error('Error fetching student. Have you run the SQL migration script yet?', studentErr.message);
        return;
    }

    if (!students || students.length === 0) {
        console.log('No students found in database. Create a student first to run trigger test.');
        return;
    }

    const testStudent = students[0];
    console.log(`Using student: ${testStudent.name} (ID: ${testStudent.id})`);
    
    // Check if column exists by verifying if it's in the object keys or checking if value is defined (can be 0 or null)
    if (testStudent.fees_classes_paid === undefined) {
        console.error('ERROR: "fees_classes_paid" column does not exist on users table! Run the migration script first.');
        return;
    }

    const initialClassesPaid = testStudent.fees_classes_paid || 0;
    console.log(`Initial fees_classes_paid: ${initialClassesPaid}`);

    // Fetch classroom for attendance link
    const { data: classrooms } = await supabase.from('classrooms').select('id, name').limit(1);
    const classroomId = classrooms?.[0]?.id || '00000000-0000-0000-0000-000000000000';

    const testDate = new Date().toISOString().split('T')[0];

    // 2. Insert attendance record (present)
    console.log(`\n2. Marking student present on ${testDate}...`);
    const { error: insertErr } = await supabase
        .from('attendance')
        .insert([{
            student_id: testStudent.id,
            classroom_id: classroomId,
            date: testDate,
            status: 'present',
            marked_by: testStudent.id // Dummy marked_by
        }]);

    if (insertErr) {
        console.error('Error inserting attendance:', insertErr.message);
        return;
    }

    // 3. Fetch student again and verify classes balance decremented
    const { data: studentPostInsert } = await supabase
        .from('users')
        .select('fees_classes_paid')
        .eq('id', testStudent.id)
        .single();

    const postInsertBalance = studentPostInsert?.fees_classes_paid ?? 0;
    console.log(`Balance after marking present: ${postInsertBalance}`);
    const successInsert = postInsertBalance === (initialClassesPaid - 1);
    console.log(`Trigger Decrement Check: ${successInsert ? '✅ SUCCESS' : '❌ FAILED'}`);

    // 4. Update attendance status to absent
    console.log(`\n3. Modifying attendance status to 'absent'...`);
    const { error: updateErr } = await supabase
        .from('attendance')
        .update({ status: 'absent' })
        .eq('student_id', testStudent.id)
        .eq('date', testDate);

    if (updateErr) {
        console.error('Error updating attendance:', updateErr.message);
        return;
    }

    // Fetch and check balance incremented back
    const { data: studentPostUpdate } = await supabase
        .from('users')
        .select('fees_classes_paid')
        .eq('id', testStudent.id)
        .single();

    const postUpdateBalance = studentPostUpdate?.fees_classes_paid ?? 0;
    console.log(`Balance after changing status to absent: ${postUpdateBalance}`);
    const successUpdate = postUpdateBalance === initialClassesPaid;
    console.log(`Trigger Increment Check: ${successUpdate ? '✅ SUCCESS' : '❌ FAILED'}`);

    // 5. Clean up by deleting the test attendance record
    console.log('\n4. Cleaning up test attendance record...');
    const { error: deleteErr } = await supabase
        .from('attendance')
        .delete()
        .eq('student_id', testStudent.id)
        .eq('date', testDate);

    if (deleteErr) {
        console.error('Error deleting attendance:', deleteErr.message);
        return;
    }
    console.log('Cleanup completed successfully.');
}

testTrigger();
