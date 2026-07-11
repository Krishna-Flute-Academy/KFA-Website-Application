const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase credentials not found.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Use existing database entities
const STUDENT_ID = 'f25de8b0-6649-4cf7-b171-4b4742884d9b';
const ROOM_A_ID = 'ab1a5bfe-4b09-47e5-9a75-f91dbc432ad4';
const ROOM_B_ID = '15d79f0f-5c27-41e1-a097-89534a966219';

async function runTest() {
    console.log("Starting classroom shift and curriculum auto-allocation verification test with existing entities...");
    
    let createdAllocationIds = [];
    let originalClassroomStudents = [];
    let originalProgressRecords = [];

    try {
        // 1. Save original classroom enrollment for the student
        console.log("\n1. Fetching original classroom enrollments...");
        const { data: origEnroll, error: enrollErr } = await supabase
            .from('classroom_students')
            .select('*')
            .eq('student_id', STUDENT_ID);
        if (enrollErr) throw enrollErr;
        originalClassroomStudents = origEnroll || [];
        console.log(`Student is currently enrolled in ${originalClassroomStudents.length} classroom(s).`);
        originalClassroomStudents.forEach(e => console.log(`- Classroom ID: ${e.classroom_id}`));

        // 2. Fetch original progress records for the student
        console.log("\n2. Fetching original progress records...");
        const { data: origProg, error: progErr } = await supabase
            .from('student_topic_progress')
            .select('*')
            .eq('student_id', STUDENT_ID);
        if (progErr) throw progErr;
        originalProgressRecords = origProg || [];
        console.log(`Student has ${originalProgressRecords.length} progress record(s).`);

        // Find a lesson from the student's progress records to use for testing
        if (originalProgressRecords.length === 0) {
            throw new Error("Cannot run test: Student has no progress records in the database.");
        }
        const testLessonId = originalProgressRecords[0].lesson_id;
        console.log(`Using lesson ID for test: ${testLessonId}`);

        // Fetch parent chapter and module for this lesson
        const { data: lessonData, error: lErr } = await supabase
            .from('course_lessons')
            .select('chapter_id')
            .eq('id', testLessonId)
            .single();
        if (lErr) throw lErr;
        const testChapterId = lessonData.chapter_id;

        const { data: chapterData, error: cErr } = await supabase
            .from('course_chapters')
            .select('module_id')
            .eq('id', testChapterId)
            .single();
        if (cErr) throw cErr;
        const testModuleId = chapterData.module_id;

        console.log(`Derived hierarchy: Module (${testModuleId}) -> Chapter (${testChapterId}) -> Lesson (${testLessonId})`);

        // 3. Create a class-wide allocation for Room A
        console.log("\n3. Creating temporary class-wide allocations in Room A...");
        const { data: newAllocs, error: allocErr } = await supabase
            .from('classroom_inventory_allocation')
            .insert([
                { classroom_id: ROOM_A_ID, module_id: testModuleId },
                { classroom_id: ROOM_A_ID, chapter_id: testChapterId },
                { classroom_id: ROOM_A_ID, lesson_id: testLessonId }
            ])
            .select();
        if (allocErr) throw allocErr;
        createdAllocationIds = newAllocs.map(a => a.id);
        console.log(`Created ${createdAllocationIds.length} class-wide allocations in Room A.`);

        // Ensure the student is enrolled in Room A
        const isEnrolledInA = originalClassroomStudents.some(e => e.classroom_id === ROOM_A_ID);
        if (!isEnrolledInA) {
            console.log("Enrolling student in Room A first...");
            const { error: eAErr } = await supabase
                .from('classroom_students')
                .insert({ classroom_id: ROOM_A_ID, student_id: STUDENT_ID });
            if (eAErr) throw eAErr;
        }

        // 4. Shift student from Room A to Room B
        console.log(`\n4. Simulating shift: moving student to Room B (${ROOM_B_ID})...`);
        console.log("Deleting enrollment from Room A...");
        const { error: delErr } = await supabase
            .from('classroom_students')
            .delete()
            .eq('student_id', STUDENT_ID)
            .eq('classroom_id', ROOM_A_ID);
        if (delErr) throw delErr;

        console.log("Inserting enrollment into Room B...");
        const { data: insertRes, error: insErr } = await supabase
            .from('classroom_students')
            .insert({ classroom_id: ROOM_B_ID, student_id: STUDENT_ID })
            .select()
            .single();
        if (insErr) throw insErr;
        console.log("Enrollment in Room B complete.");

        // Wait a brief moment for trigger to complete async operations (if any)
        await new Promise(r => setTimeout(r, 2000));

        // 5. Verify that progress records are now in Room B
        console.log("\n5. Verifying progress records classroom_id...");
        const { data: shiftedProgs, error: vProgErr } = await supabase
            .from('student_topic_progress')
            .select('*')
            .eq('student_id', STUDENT_ID);
        if (vProgErr) throw vProgErr;

        let allShifted = true;
        shiftedProgs.forEach(p => {
            console.log(`- Progress ID: ${p.id}, Lesson: ${p.lesson_id}, Classroom ID: ${p.classroom_id}`);
            if (p.classroom_id !== ROOM_B_ID) {
                allShifted = false;
            }
        });

        if (!allShifted) {
            throw new Error("FAIL: Some progress records were not updated to Room B.");
        }
        console.log("PASS: All progress records successfully updated to Room B!");

        // 6. Verify that student-specific allocations were created in Room B
        console.log("\n6. Verifying student-specific allocations in Room B...");
        const { data: roomBAllocs, error: vAllocErr } = await supabase
            .from('classroom_inventory_allocation')
            .select('*')
            .eq('classroom_id', ROOM_B_ID)
            .eq('allocated_to_student_id', STUDENT_ID);
        if (vAllocErr) throw vAllocErr;

        console.log(`Found ${roomBAllocs.length} student-specific allocations in Room B.`);
        roomBAllocs.forEach(a => {
            console.log(`- Allocation ID: ${a.id}, Module: ${a.module_id}, Chapter: ${a.chapter_id}, Lesson: ${a.lesson_id}`);
        });

        const hasLessonAlloc = roomBAllocs.some(a => a.lesson_id === testLessonId);
        const hasChapterAlloc = roomBAllocs.some(a => a.chapter_id === testChapterId);
        const hasModuleAlloc = roomBAllocs.some(a => a.module_id === testModuleId);

        if (!hasLessonAlloc) throw new Error("FAIL: Lesson was not auto-allocated in Room B.");
        if (!hasChapterAlloc) throw new Error("FAIL: Chapter was not auto-allocated in Room B.");
        if (!hasModuleAlloc) throw new Error("FAIL: Module/Level was not auto-allocated in Room B.");

        console.log("PASS: Lesson, Chapter, and Level were successfully auto-allocated in Room B!");
        console.log("\nALL VERIFICATIONS PASSED SUCCESSFULLY!");

    } catch (e) {
        console.error("\nTEST FAILED WITH ERROR:", e.message || e);
    } finally {
        console.log("\n--- REVERTING CHANGES TO RESTORE DATABASE STATE ---");

        // 1. Delete student-specific allocations created in Room B
        console.log("Deleting student-specific allocations in Room B...");
        const { error: cleanupBAllocsErr } = await supabase
            .from('classroom_inventory_allocation')
            .delete()
            .eq('classroom_id', ROOM_B_ID)
            .eq('allocated_to_student_id', STUDENT_ID);
        if (cleanupBAllocsErr) console.error("Error deleting Room B allocations:", cleanupBAllocsErr);

        // 2. Delete class-wide allocations created in Room A
        if (createdAllocationIds.length > 0) {
            console.log("Deleting class-wide allocations in Room A...");
            const { error: cleanupAAllocsErr } = await supabase
                .from('classroom_inventory_allocation')
                .delete()
                .in('id', createdAllocationIds);
            if (cleanupAAllocsErr) console.error("Error deleting Room A allocations:", cleanupAAllocsErr);
        }

        // 3. Delete enrollment in Room B
        console.log("Deleting enrollment in Room B...");
        const { error: delBErr } = await supabase
            .from('classroom_students')
            .delete()
            .eq('student_id', STUDENT_ID)
            .eq('classroom_id', ROOM_B_ID);
        if (delBErr) console.error("Error deleting Room B enrollment:", delBErr);

        // 4. Restore original classroom enrollments
        console.log("Restoring original classroom enrollments...");
        for (const e of originalClassroomStudents) {
            const { error: restoreEnrollErr } = await supabase
                .from('classroom_students')
                .insert({
                    classroom_id: e.classroom_id,
                    student_id: e.student_id,
                    joined_at: e.joined_at
                });
            if (restoreEnrollErr) console.error(`Error restoring enrollment in ${e.classroom_id}:`, restoreEnrollErr.message);
        }

        // 5. Restore original classroom IDs in progress records
        console.log("Restoring original classroom IDs in progress records...");
        for (const p of originalProgressRecords) {
            const { error: restoreProgErr } = await supabase
                .from('student_topic_progress')
                .update({ classroom_id: p.classroom_id })
                .eq('id', p.id);
            if (restoreProgErr) console.error(`Error restoring progress ID ${p.id}:`, restoreProgErr.message);
        }

        console.log("Database state restored.");
    }
}

runTest();
