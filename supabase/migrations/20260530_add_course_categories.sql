-- ============================================================
-- Migration: Add Course Categories (Headlines) Table & Relations
-- Target: KFA Database
-- ============================================================

-- ── 1. Create Course Categories (Headlines) Table ────────────
CREATE TABLE IF NOT EXISTS public.course_categories (
  id             UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT          NOT NULL UNIQUE,
  category_order INTEGER       NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ   DEFAULT now(),
  updated_at     TIMESTAMPTZ   DEFAULT now()
);

-- ── 2. Add category_id to course_modules ─────────────────────
ALTER TABLE public.course_modules
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.course_categories(id) ON DELETE SET NULL;

-- ── 3. Enable RLS and Policies ──────────────────────────────
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all course_categories" ON public.course_categories;
CREATE POLICY "Allow all course_categories" ON public.course_categories FOR ALL USING (true) WITH CHECK (true);

-- ── 4. Seed Standard Categories ──────────────────────────────
INSERT INTO public.course_categories (id, name, category_order)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Proficiency Levels', 1),
  ('c1000000-0000-0000-0000-000000000002', 'Specialized Modules', 2),
  ('c1000000-0000-0000-0000-000000000003', 'Compositions', 3),
  ('c1000000-0000-0000-0000-000000000004', 'Songs', 4)
ON CONFLICT (name) DO UPDATE SET category_order = EXCLUDED.category_order;

-- ── 5. Migrate Existing course_modules ───────────────────────
-- Link Core Tracks (module_number < 100) to Proficiency Levels
UPDATE public.course_modules
SET category_id = 'c1000000-0000-0000-0000-000000000001'
WHERE module_number < 100;

-- Link Swar Gyan Ear Training to Specialized Modules
UPDATE public.course_modules
SET category_id = 'c1000000-0000-0000-0000-000000000002'
WHERE title = 'Swar Gyan Ear Training';

-- Link Compositions
UPDATE public.course_modules
SET category_id = 'c1000000-0000-0000-0000-000000000003'
WHERE title LIKE 'Composition%' OR title LIKE '%Composition%';

-- Link Songs
UPDATE public.course_modules
SET category_id = 'c1000000-0000-0000-0000-000000000004'
WHERE title LIKE 'Song%' OR title LIKE '%Songbook%' OR title = 'Song Database';

-- Fallback for any other modules: link to Specialized Modules
UPDATE public.course_modules
SET category_id = 'c1000000-0000-0000-0000-000000000002'
WHERE category_id IS NULL AND module_number >= 100;
