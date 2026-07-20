const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env manually to avoid dependencies
const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    }
});

const supabaseUrl = env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 1. Find the classroom ID for "Monday morning"
    const { data: classrooms, error: classError } = await supabase
        .from('classrooms')
        .select('id, name')
        .eq('name', 'Monday morning');
    
    if (classError) {
        console.error('Error fetching classroom:', classError);
        return;
    }
    
    console.log('Classrooms matching "Monday morning":', classrooms);
    if (!classrooms || classrooms.length === 0) return;
    
    const classroomId = classrooms[0].id;
    
    // 2. Fetch all allocations for this classroom
    const { data: allocations, error: allocError } = await supabase
        .from('classroom_inventory_allocation')
        .select('*')
        .eq('classroom_id', classroomId);
        
    if (allocError) {
        console.error('Error fetching allocations:', allocError);
        return;
    }
    
    console.log(`Total allocations found: ${allocations.length}`);
    allocations.slice(0, 50).forEach((a, idx) => {
        console.log(`[${idx}] id: ${a.id}, module_id: ${a.module_id}, chapter_id: ${a.chapter_id}, lesson_id: ${a.lesson_id}, student_id: ${a.allocated_to_student_id}`);
    });
}

run();
