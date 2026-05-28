-- ============================================================
-- Migration: Add status Column to assignments Table
-- Target: AUTH Supabase project
-- Run this in your Supabase SQL Editor → New Query
-- ============================================================

ALTER TABLE public.assignments 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
