-- Migration: Drop exact duplicate indexes to reduce PostgreSQL write-amplification and Disk I/O
-- Targets exactly 16 proven redundant duplicate indexes across 5 tables
-- Retains all primary key indexes, unique constraints, and unique coverage indexes

-- 1. Table: classroom_inventory_allocation
-- Drop duplicates on (allocated_to_student_id) -> Kept: idx_classroom_inventory_allocation_student_id
DROP INDEX IF EXISTS public.idx_cia_student_id;
DROP INDEX IF EXISTS public.idx_classroom_inv_alloc_student;
DROP INDEX IF EXISTS public.idx_classroom_inventory_alloc_student;
DROP INDEX IF EXISTS public.idx_inventory_allocation_student;

-- Drop duplicates on (classroom_id) -> Kept: idx_classroom_inventory_allocation_classroom_id
DROP INDEX IF EXISTS public.idx_cia_classroom_id;
DROP INDEX IF EXISTS public.idx_classroom_inv_alloc_room;
DROP INDEX IF EXISTS public.idx_classroom_inventory_alloc_classroom;
DROP INDEX IF EXISTS public.idx_inventory_allocation_classroom;

-- 2. Table: classroom_students
-- Drop duplicates on (student_id) -> Kept: classroom_students_student_idx
DROP INDEX IF EXISTS public.idx_classroom_students_student;
DROP INDEX IF EXISTS public.idx_classroom_students_student_id;

-- 3. Table: course_chapters
-- Drop duplicate on (chapter_number) -> Kept: course_chapters_chapter_number_idx
DROP INDEX IF EXISTS public.course_chapters_chapter_number_idx1;

-- Drop duplicate on (module_id) -> Kept: idx_course_chapters_module
DROP INDEX IF EXISTS public.idx_course_chapters_module_id;

-- 4. Table: course_lessons
-- Drop duplicate on (chapter_id) -> Kept: idx_course_lessons_chapter
DROP INDEX IF EXISTS public.idx_course_lessons_chapter_id;

-- 5. Table: student_topic_progress
-- Drop duplicate on (student_id) -> Kept: idx_student_topic_progress_student
DROP INDEX IF EXISTS public.idx_student_topic_progress_student_id;

-- Drop duplicate on (classroom_id) -> Kept: idx_student_topic_progress_classroom
DROP INDEX IF EXISTS public.idx_student_topic_progress_classroom_id;

-- Drop redundant non-unique duplicate on (student_id, lesson_id) -> Kept: student_topic_progress_student_id_lesson_id_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_student_topic_progress_student_lesson;
