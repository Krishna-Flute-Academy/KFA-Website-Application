-- Migration: Optimize Attendance Indexes and Constraints
-- Purpose: Reduce Disk IO caused by missing indexes on PostgREST queries and upserts

-- 1. Optimize Read Queries with OFFSET (e.g., student attendance history pages)
-- These indexes prevent full table scans when filtering by student or classroom.
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_classroom_id ON public.attendance(classroom_id);

-- 2. Optimize Upsert Path (Conflict Resolution)
-- The frontend explicitly calls .upsert() with { onConflict: 'classroom_id,student_id,date' }.
-- To resolve this without heavy disk scans, Postgres requires an explicit UNIQUE constraint on these exact columns.
-- We use a DO block to safely add the constraint only if it doesn't already exist.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'attendance_classroom_student_date_key'
    ) THEN
        ALTER TABLE public.attendance 
        ADD CONSTRAINT attendance_classroom_student_date_key UNIQUE (classroom_id, student_id, date);
    END IF;
END $$;
