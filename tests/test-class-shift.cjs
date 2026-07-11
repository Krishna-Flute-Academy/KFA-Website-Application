const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
    try {
        const roomA = { id: '1c1ae77b-b4aa-4a8e-ac75-9ccd0c009fa3', name: 'Test-2' };
        const roomB = { id: '28929010-18b2-4ccd-837f-8c62b8f539a8', name: 'Test-Class-2' };
        console.log(`- Classroom A: ${roomA.name} (${roomA.id})`);
        console.log(`- Classroom B: ${roomB.name} (${roomB.id})`);

        console.log("\n2. Finding a dummy student or existing student to test with...");
        const studentId = 'c3e2d9ff-33ae-4d83-950c-a4f4cc7148e6';
        
        // Check current assignments
        const { data: currentAssignments } = await supabase
            .from('classroom_students')
            .select('*')
            .eq('student_id', studentId);
        
        console.log(`Current classroom assignments count: ${currentAssignments.length}`);
        currentAssignments.forEach(a => console.log(`- Classroom: ${a.classroom_id}`));

        // Check if student has progress records
        const { data: progressA } = await supabase
            .from('student_topic_progress')
            .select('id, lesson_id, classroom_id, status')
            .eq('student_id', studentId);
        
        console.log(`Current progress records count: ${progressA.length}`);
        
        // Let's find a lesson to use
        const { data: lessons } = await supabase.from('course_lessons').select('id').limit(1);
        if (lessons.length === 0) {
            console.log("No lessons in database.");
            return;
        }
        const lessonId = lessons[0].id;

        // Ensure there is at least one progress record for this lesson in classroom A
        console.log(`\n3. Ensuring a completed progress record exists for student on lesson ${lessonId} under room A (${roomA.id})...`);
        const { error: upsertError } = await supabase
            .from('student_topic_progress')
            .upsert({
                student_id: studentId,
                classroom_id: roomA.id,
                lesson_id: lessonId,
                status: 'completed',
                unlocked_by: 'student'
            }, { onConflict: 'student_id, lesson_id' });
        
        if (upsertError) throw upsertError;

        // Retrieve and print progress records
        const { data: progressBefore } = await supabase
            .from('student_topic_progress')
            .select('id, lesson_id, classroom_id, status')
            .eq('student_id', studentId);
        console.log(`Progress records before shift:`);
        progressBefore.forEach(p => console.log(`- Lesson: ${p.lesson_id}, Classroom: ${p.classroom_id}, Status: ${p.status}`));

        console.log(`\n4. Simulating shift to Room B (${roomB.id})...`);
        console.log("Deleting from classroom_students...");
        const { error: delError } = await supabase
            .from('classroom_students')
            .delete()
            .eq('student_id', studentId);
        if (delError) throw delError;

        console.log("Inserting new row into classroom_students for Room B...");
        const { error: insError } = await supabase
            .from('classroom_students')
            .insert({
                classroom_id: roomB.id,
                student_id: studentId,
                joined_at: new Date().toISOString()
            });
        
        if (insError) throw insError;
        console.log("Shift simulation complete!");

        console.log(`\n5. Verifying progress records after shift...`);
        const { data: progressAfter } = await supabase
            .from('student_topic_progress')
            .select('id, lesson_id, classroom_id, status')
            .eq('student_id', studentId);
        
        console.log(`Progress records after shift:`);
        progressAfter.forEach(p => console.log(`- Lesson: ${p.lesson_id}, Classroom: ${p.classroom_id}, Status: ${p.status}`));

        // Cleanup: restore student assignment to Room A
        console.log("\n6. Restoring student assignment to Room A...");
        await supabase.from('classroom_students').delete().eq('student_id', studentId);
        await supabase.from('classroom_students').insert({
            classroom_id: roomA.id,
            student_id: studentId,
            joined_at: new Date().toISOString()
        });

    } catch (e) {
        console.error("Test failed with error:", e);
    }
}

runTest();
