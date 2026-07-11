const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase credentials not found.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const studentIds = [
    'c3e2d9ff-33ae-4d83-950c-a4f4cc7148e6',
    'e096808f-b1be-400e-90bc-22898e096b6e'
];

async function inspect() {
    try {
        for (const studentId of studentIds) {
            console.log(`\n==================================================`);
            console.log(`INSPECTING STUDENT ID: ${studentId}`);
            
            console.log("\n1. Querying classroom_students...");
            const { data: classStudents, error: csError } = await supabase
                .from('classroom_students')
                .select('*, classrooms(*)')
                .eq('student_id', studentId);
            
            if (csError) throw csError;
            console.log(`Classroom Assignments (${classStudents.length}):`);
            classStudents.forEach(cs => {
                console.log(`- Link ID: ${cs.id}, Classroom ID: ${cs.classroom_id}, Class Name: ${cs.classrooms?.name}, Joined At: ${cs.joined_at}`);
            });

            console.log("\n2. Querying student_topic_progress (Active progress)...");
            const { data: progress, error: progError } = await supabase
                .from('student_topic_progress')
                .select('*, classrooms(*), course_lessons(*)')
                .eq('student_id', studentId)
                .in('status', ['unlocked', 'completed']);
            
            if (progError) throw progError;
            console.log(`Unlocked/Completed Progress Records (${progress.length}):`);
            progress.forEach(p => {
                console.log(`- Progress ID: ${p.id}, Lesson: Topic ${p.course_lessons?.lesson_number} - ${p.course_lessons?.title}, Status: ${p.status}, Classroom ID: ${p.classroom_id}, Class Name: ${p.classrooms?.name}`);
            });

            console.log("\n3. Querying classroom_inventory_allocation...");
            const { data: allocations, error: allocError } = await supabase
                .from('classroom_inventory_allocation')
                .select('*, classrooms(*)')
                .eq('allocated_to_student_id', studentId);
            
            if (allocError) throw allocError;
            console.log(`Student-Specific Inventory Allocations (${allocations.length}):`);
            allocations.forEach(a => {
                console.log(`- Allocation ID: ${a.id}, Class Name: ${a.classrooms?.name}, Module ID: ${a.module_id}, Chapter ID: ${a.chapter_id}, Lesson ID: ${a.lesson_id}`);
            });
        }
    } catch (err) {
        console.error("Error during inspection:", err);
    }
}

inspect();
