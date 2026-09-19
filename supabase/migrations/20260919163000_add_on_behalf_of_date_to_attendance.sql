-- Migration: Add on_behalf_of_date to attendance table
-- Enables classes taken on behalf of another scheduled date without complex entitlement engines.

-- 1. Add on_behalf_of_date column to public.attendance
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS on_behalf_of_date DATE;

-- 2. Index on on_behalf_of_date for fast lookups
CREATE INDEX IF NOT EXISTS idx_attendance_on_behalf_of_date
  ON public.attendance(on_behalf_of_date)
  WHERE on_behalf_of_date IS NOT NULL;

-- 3. Enforce that a student cannot have multiple attendance records satisfying the same target date
-- Notice: We do NOT scope to classroom_id so that physical attendance across special sessions/overrides
-- cannot accidentally satisfy the same target scheduled date twice for the same student.
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_student_on_behalf_of_date
  ON public.attendance(student_id, on_behalf_of_date)
  WHERE on_behalf_of_date IS NOT NULL;
