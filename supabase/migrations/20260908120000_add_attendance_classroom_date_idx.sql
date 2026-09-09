-- Migration: Add composite index on public.attendance(classroom_id, date)
-- Drastically accelerates attendance count aggregation in end_classroom_session RPC
-- and pre-session attendance fetching in the classroom meeting hub.

CREATE INDEX IF NOT EXISTS idx_attendance_classroom_date 
ON public.attendance(classroom_id, date);
