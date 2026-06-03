-- Migration to add status column to classrooms table
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
