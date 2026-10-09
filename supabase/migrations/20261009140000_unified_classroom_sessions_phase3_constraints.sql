-- ============================================================================
-- KFA Production Migration — Phase 3: Constraint Finalization (Post-Cutover)
-- Migration ID: 20261009140000_unified_classroom_sessions_phase3_constraints.sql
-- Description: Transition from legacy 3-column constraint to 4-column multi-session constraint
-- NOTE: Execute ONLY after Phase 1 and Application Frontend Deployment are verified!
-- ============================================================================

-- Drop legacy 3-column unique constraints safely
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_classroom_student_date_key;

ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS unique_student_attendance;

-- Apply single unified 4-column constraint with NULLS NOT DISTINCT
-- In PostgreSQL 15+, NULLS NOT DISTINCT guarantees (classroom_id, student_id, date, NULL)
-- is treated as unique, while permitting multiple distinct session UUIDs on the same date!
ALTER TABLE public.attendance 
ADD CONSTRAINT uq_attendance_session_student 
UNIQUE NULLS NOT DISTINCT (classroom_id, student_id, date, session_id);

CREATE INDEX IF NOT EXISTS idx_attendance_session_lookup 
ON public.attendance(classroom_id, date, session_id);
