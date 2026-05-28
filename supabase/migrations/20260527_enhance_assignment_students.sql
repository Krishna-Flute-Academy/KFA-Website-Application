-- ============================================================
-- Migration: Enhance assignment_students Table for Tasks
-- Target: AUTH Supabase project
-- Run this in your Supabase SQL Editor → New Query
-- ============================================================

ALTER TABLE public.assignment_students 
  ADD COLUMN IF NOT EXISTS score NUMERIC,
  ADD COLUMN IF NOT EXISTS proficiency_level TEXT,
  ADD COLUMN IF NOT EXISTS feedback_text TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now();
