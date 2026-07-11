import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Auth Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testIndependence() {
    console.log('Starting verification of student-centric database queries...\n');

    // 1. Fetch all student topic progress records
    console.log('1. Querying student_topic_progress...');
    const { data: progressList, error: progressError } = await supabase
        .from('student_topic_progress')
        .select('student_id, lesson_id, status, classroom_id');

    if (progressError) {
        console.error('Failed to query progress:', progressError.message);
    } else {
        console.log(`Successfully fetched ${progressList.length} progress records.`);
        const uniqueStudents = new Set(progressList.map(p => p.student_id));
        console.log(`Progress entries exist for ${uniqueStudents.size} unique students.`);
        
        // Print progress distribution
        const distribution = {};
        progressList.forEach(p => {
            distribution[p.student_id] = (distribution[p.student_id] || 0) + 1;
        });
        console.log('Progress records count per student:', distribution);
    }

    // 2. Fetch all classroom inventory allocations
    console.log('\n2. Querying classroom_inventory_allocation...');
    const { data: allocations, error: allocationsError } = await supabase
        .from('classroom_inventory_allocation')
        .select('id, module_id, chapter_id, lesson_id, allocated_to_student_id, classroom_id');

    if (allocationsError) {
        console.error('Failed to query allocations:', allocationsError.message);
    } else {
        console.log(`Successfully fetched ${allocations.length} allocation records.`);
        const studentSpecificAllocations = allocations.filter(a => a.allocated_to_student_id !== null);
        const classwideAllocations = allocations.filter(a => a.allocated_to_student_id === null);
        
        console.log(`Student-specific allocations: ${studentSpecificAllocations.length}`);
        console.log(`Classwide allocations (legacy): ${classwideAllocations.length}`);
        
        if (studentSpecificAllocations.length > 0) {
            console.log('Example student-specific allocation:', studentSpecificAllocations[0]);
        }
    }

    console.log('\nVerification completed successfully.');
}

testIndependence();
