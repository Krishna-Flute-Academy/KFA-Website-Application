-- Migration: Change fees_collection_date from DATE to INTEGER (1-31)
-- Alter users table fees_collection_date column to be day of month (integer).

-- 1. Drop existing column (if it exists as DATE)
ALTER TABLE public.users DROP COLUMN IF EXISTS fees_collection_date;

-- 2. Add column as INTEGER with CHECK constraint
ALTER TABLE public.users 
ADD COLUMN fees_collection_date INTEGER CHECK (fees_collection_date >= 1 AND fees_collection_date <= 31);
