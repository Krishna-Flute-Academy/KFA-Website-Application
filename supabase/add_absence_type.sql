-- Run this in your Supabase SQL Editor to add the absence_type column
-- This allows the system to distinguish between "Prior informed" and "Not joined" absences.

ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS absence_type TEXT;

-- Optionally, you can add a check constraint to ensure only valid absence types are used
ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_absence_type_check 
CHECK (absence_type IN ('prior_informed', 'not_joined') OR absence_type IS NULL);
