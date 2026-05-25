import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sevtycwrmhzyfxvxkkgc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNldnR5Y3dybWh6eWZ4dnhra2djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNTI1OTgsImV4cCI6MjA4ODYyODU5OH0.2Xogmd7xqfXg2AUP9PTWisTtAn2SXsAJUWWYWYB-XNs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testStatus(statusValue) {
    const randomId = '00000000-0000-0000-0000-000000000000';
    const { error } = await supabase.from('attendance').insert([{
        student_id: randomId,
        classroom_id: randomId,
        date: '2026-05-25',
        status: statusValue,
        marked_by: randomId
    }]);
    
    if (error && error.code === '23514') {
        console.log(`Status '${statusValue}': INVALID (Check constraint violation)`);
    } else if (error && error.code === 'PGRST204') {
        console.log(`Status '${statusValue}': INVALID (Column or type not found)`);
    } else if (error) {
        console.log(`Status '${statusValue}': VALID (Returned database error: ${error.code} - ${error.message})`);
    } else {
        console.log(`Status '${statusValue}': VALID (Success!)`);
    }
}

async function run() {
    const values = ['present', 'absent', 'late', 'excused', 'prior_informed', 'not_joined'];
    console.log('Testing allowed status values:');
    for (const val of values) {
        await testStatus(val);
    }
}

run();
