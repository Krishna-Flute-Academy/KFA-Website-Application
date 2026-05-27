-- ============================================================
-- SAFE Migration: Add Assignments & Class Notes Tables
-- Target: AUTH Supabase project (sevtycwrmhzyfxvxkkgc)
-- Run this in your Supabase SQL Editor → New Query
-- ============================================================

-- ── 1. Class Notes Table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_notes (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID        NOT NULL,
  teacher_id  UUID         NOT NULL,
  title       TEXT         NOT NULL,
  content     TEXT,
  file_url    TEXT,
  file_name   TEXT,
  file_size   INTEGER,
  color       TEXT         DEFAULT 'yellow',
  created_at  TIMESTAMPTZ  DEFAULT now(),
  updated_at  TIMESTAMPTZ  DEFAULT now()
);

-- ── 2. Assignments Table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assignments (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID         NOT NULL,
  teacher_id   UUID         NOT NULL,
  title        TEXT         NOT NULL,
  description  TEXT,
  due_date     DATE,
  target_type  TEXT         NOT NULL DEFAULT 'all',
  file_url     TEXT,
  file_name    TEXT,
  file_size    INTEGER,
  created_at   TIMESTAMPTZ  DEFAULT now()
);

-- ── 3. Assignment Students Table ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.assignment_students (
  id            UUID   DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID   NOT NULL,
  student_id    UUID   NOT NULL,
  status        TEXT   DEFAULT 'pending',
  UNIQUE (assignment_id, student_id)
);

-- ── 4. Enable RLS ─────────────────────────────────────────────
ALTER TABLE public.class_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_students ENABLE ROW LEVEL SECURITY;

-- ── 5. Permissive policies (allow all for anon + authenticated) ──
-- class_notes
DROP POLICY IF EXISTS "Allow all class_notes" ON public.class_notes;
CREATE POLICY "Allow all class_notes"
  ON public.class_notes FOR ALL
  USING (true) WITH CHECK (true);

-- assignments
DROP POLICY IF EXISTS "Allow all assignments" ON public.assignments;
CREATE POLICY "Allow all assignments"
  ON public.assignments FOR ALL
  USING (true) WITH CHECK (true);

-- assignment_students
DROP POLICY IF EXISTS "Allow all assignment_students" ON public.assignment_students;
CREATE POLICY "Allow all assignment_students"
  ON public.assignment_students FOR ALL
  USING (true) WITH CHECK (true);

-- ── 6. Storage Bucket for file uploads ───────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('class_notes', 'class_notes', true)
ON CONFLICT (id) DO NOTHING;

-- Drop old conflicting policies if any
DROP POLICY IF EXISTS "Public read access for class_notes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload to class_notes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete from class_notes" ON storage.objects;
DROP POLICY IF EXISTS "Anon upload to class_notes" ON storage.objects;

-- Create storage policies
CREATE POLICY "Allow all reads on class_notes bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'class_notes');

CREATE POLICY "Allow all inserts on class_notes bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'class_notes');

CREATE POLICY "Allow all deletes on class_notes bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'class_notes');
