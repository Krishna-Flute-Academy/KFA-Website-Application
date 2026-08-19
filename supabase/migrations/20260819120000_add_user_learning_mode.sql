-- Migration: Add learning_mode column to public.users table
-- Allows designating student class format as 'online' (Live Digital Class) or 'offline' (In-Person Classroom)

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS learning_mode TEXT DEFAULT 'online';
