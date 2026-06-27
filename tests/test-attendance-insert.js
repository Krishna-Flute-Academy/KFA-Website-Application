import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sevtycwrmhzyfxvxkkgc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNldnR5Y3dybWh6eWZ4dnhra2djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNTI1OTgsImV4cCI6MjA4ODYyODU5OH0.2Xogmd7xqfXg2AUP9PTWisTtAn2SXsAJUWWYWYB-XNs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSchema() {
    // 1. Get a user
    const { data: users } = await supabase.from('users').select('id').limit(1);
    const userId = users?.[0]?.id;
    
    // 2. Get a classroom
    const { data: classes } = await supabase.from('classrooms').select('id').limit(1);
    const classId = classes?.[0]?.id;

    if (!userId || !classId) {
        console.log('No user or class found');
        return;
    }

    // 3. Insert dummy attendance
    const dummy = {
        student_id: userId,
        classroom_id: classId,
        date: '2099-01-01',
        status: 'present'
    };

    console.log('Inserting...', dummy);
    const { data, error } = await supabase.from('attendance').insert(dummy).select('*');
    
    if (error) {
        console.error('Insert error:', error);
    } else {
        console.log('Inserted row columns:', Object.keys(data[0]));
        // cleanup
        await supabase.from('attendance').delete().eq('date', '2099-01-01');
    }
}

testSchema();
