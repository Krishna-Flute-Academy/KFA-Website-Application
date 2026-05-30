-- ============================================================
-- Migration: Add inventory_ref columns to assignments table
-- These columns are needed for the curriculum allocation system
-- to track which module/chapter/lesson an assignment refers to.
-- Run this in your Supabase SQL Editor → New Query
-- ============================================================

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS inventory_ref_type  TEXT,      -- 'module', 'chapter', or 'lesson'
  ADD COLUMN IF NOT EXISTS inventory_ref_id    UUID,      -- references the actual module/chapter/lesson ID
  ADD COLUMN IF NOT EXISTS inventory_ref_title TEXT;      -- human-readable title for quick display
