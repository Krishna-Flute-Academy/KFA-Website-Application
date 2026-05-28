-- ============================================================
-- SAFE Migration: Add Course Inventory Library Tables
-- Target: AUTH Supabase project (sevtycwrmhzyfxvxkkgc)
-- Run this in your Supabase SQL Editor → New Query
-- ============================================================

-- ── 1. Course Modules Table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_modules (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT         NOT NULL,
  description   TEXT,
  module_number INTEGER      NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ  DEFAULT now(),
  updated_at    TIMESTAMPTZ  DEFAULT now()
);

-- ── 2. Course Chapters Table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_chapters (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id     UUID         NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title         TEXT         NOT NULL,
  description   TEXT,
  chapter_number INTEGER     NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ  DEFAULT now(),
  updated_at    TIMESTAMPTZ  DEFAULT now()
);

-- ── 3. Course Lessons Table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_lessons (
  id                 UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id         UUID         NOT NULL REFERENCES public.course_chapters(id) ON DELETE CASCADE,
  title              TEXT         NOT NULL,
  description        TEXT,
  lesson_number      INTEGER      NOT NULL DEFAULT 1,
  material_type      TEXT         NOT NULL DEFAULT 'pdf', -- 'pdf', 'video', 'youtube_url', 'audio', 'note', 'checklist', 'article'
  material_url       TEXT,        -- Supabase Storage URL or YouTube URL
  file_name          TEXT,
  file_size          TEXT,        -- e.g. "1.2MB"
  duration           TEXT,        -- e.g. "12:45"
  is_introductory    BOOLEAN      DEFAULT false,
  is_very_important  BOOLEAN      DEFAULT false,
  bullet_points      TEXT[]       DEFAULT '{}',
  image_url          TEXT,        -- for featured lesson images
  link_url           TEXT,        -- clickable external web link
  created_at         TIMESTAMPTZ  DEFAULT now(),
  updated_at         TIMESTAMPTZ  DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;

-- Create Permissive Policies (matching KFA development environment)
DROP POLICY IF EXISTS "Allow all course_modules" ON public.course_modules;
CREATE POLICY "Allow all course_modules" ON public.course_modules FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all course_chapters" ON public.course_chapters;
CREATE POLICY "Allow all course_chapters" ON public.course_chapters FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all course_lessons" ON public.course_lessons;
CREATE POLICY "Allow all course_lessons" ON public.course_lessons FOR ALL USING (true) WITH CHECK (true);

-- ── 4. Storage Bucket for Learning Materials ────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory_materials', 'inventory_materials', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow all reads on inventory_materials bucket" ON storage.objects;
CREATE POLICY "Allow all reads on inventory_materials bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'inventory_materials');

DROP POLICY IF EXISTS "Allow all inserts on inventory_materials bucket" ON storage.objects;
CREATE POLICY "Allow all inserts on inventory_materials bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'inventory_materials');

DROP POLICY IF EXISTS "Allow all deletes on inventory_materials bucket" ON storage.objects;
CREATE POLICY "Allow all deletes on inventory_materials bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'inventory_materials');

-- ── 5. Seed Initial Data ──────────────────────────────────────

-- A. Seed Course Modules
INSERT INTO public.course_modules (id, title, description, module_number)
VALUES 
  ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Level 1', 'Foundation of music theory, notes, and basic rhythm patterns.', 1),
  ('a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Level 2', 'Introduction to scales, major chords, and simple compositions.', 2),
  ('a3b4c5d6-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Level 3', 'Complex rhythms, dynamic notations, and ear training exercises.', 3),
  ('a4b5c6d7-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Level 4', 'Professional performance techniques and harmonic analysis.', 4)
ON CONFLICT (id) DO NOTHING;

-- B. Seed Course Chapters
INSERT INTO public.course_chapters (id, module_id, title, description, chapter_number)
VALUES 
  -- Level 1 Chapters
  ('b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Chapter 1 - Introduction to Flute', 'What is the Flute?
• Introduction to the Indian bamboo flute
• Importance of flute in Indian music
• Role of the flute in Hindustani Classical Music', 1),
  ('c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Chapter 2 - Producing the First Sound', 'First Blow – Producing the Sound
• Understanding how to blow into the flute
• Lip position (embouchure)
• Producing the first clear sound', 2),
  ('d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Chapter 3 - Lower Octave Notes', '5 Essential topics • Dot notation and finger control', 3),
  ('e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Chapter 4 - Actual Pa', '4 Essential topics • Note transitions and compositions', 4),
  ('f1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Chapter 5 - Strong Note Control', '3 Essential topics • Breath control and tone stability', 5),
  ('a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Chapter 6 - Completing Middle Octave', '5 Essential topics • Alankars and first songs', 6),
  
  -- Level 2 Chapters
  ('chap_l2_c1', 'a2b3c4d5-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Chapter 1 - Elementary Scales', '4 Essential topics • Scale structures', 1),
  
  -- Level 3 Chapters
  ('chap_l3_c1', 'a3b4c5d6-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Chapter 1 - Intermediate Rhythms', '6 Essential topics • Triple meter structures', 1),
  
  -- Level 4 Chapters
  ('chap_l4_c1', 'a4b5c6d7-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Chapter 1 - Advanced Improvisation', '5 Essential topics • Rhythmic subdivisions', 1)
ON CONFLICT (id) DO NOTHING;

-- C. Seed Course Lessons/Topics for Chapter 1 & Chapter 2
INSERT INTO public.course_lessons (id, chapter_id, title, description, lesson_number, material_type, file_size, duration, is_introductory, is_very_important, bullet_points, link_url)
VALUES
  (
    'c01e02-1111-2222-3333-444444444444', 
    'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e', 
    'Understanding the Hindustani Classical Flute', 
    'Structure of the bamboo flute, blowing hole and finger holes, and how sound is produced.', 
    1, 
    'pdf', 
    '0.9MB', 
    'PDF • 0.9MB', 
    false, 
    false, 
    ARRAY['Structure of the bamboo flute', 'Blowing hole and finger holes', 'How sound is produced'],
    'https://krishnaflute.com/acoustics'
  ),
  (
    'c01e03-1111-2222-3333-444444444444', 
    'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e', 
    'Types of Flutes', 
    'Small flute (higher pitch), medium flute, bass / long flute, pitch examples (C, D, E, F, G etc.), and which flute beginners should start with.', 
    2, 
    'video', 
    NULL, 
    'VIDEO • 12:45', 
    false, 
    false, 
    ARRAY['Small flute (higher pitch)', 'Medium flute', 'Bass / long flute', 'Pitch examples (C, D, E, F, G etc.)', 'Which flute beginners should start with'],
    NULL
  ),
  (
    'c01e04-1111-2222-3333-444444444444', 
    'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e', 
    'Flute Structure', 
    'Number of holes (6 hole / 7 hole flute), blow hole, finger holes, cork position, and why thread is tied on flute.', 
    3, 
    'pdf', 
    '1.5MB', 
    'PDF • 1.5MB', 
    false, 
    false, 
    ARRAY['Number of holes (6 hole / 7 hole flute)', 'Blow hole', 'Finger holes', 'Cork position', 'Why thread is tied on flute'],
    NULL
  ),
  (
    'c01e05-1111-2222-3333-444444444444', 
    'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e', 
    'Correct Sitting & Body Posture', 
    'Sitting position, back posture, hand position, how to hold the flute properly, and yoga for flute.', 
    4, 
    'video', 
    NULL, 
    'VIDEO • 08:20', 
    false, 
    false, 
    ARRAY['Sitting position', 'Back posture', 'Hand position', 'How to hold the flute properly', 'Yoga for flute'],
    NULL
  ),
  (
    'c01e06-1111-2222-3333-444444444444', 
    'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e', 
    'Breath & Blowing Basics', 
    'How to blow air, breath control basics, and common mistakes beginners make.', 
    5, 
    'video', 
    NULL, 
    'VIDEO • 15:10', 
    false, 
    true, 
    ARRAY['How to blow air', 'Breath control basics', 'Common mistakes beginners make'],
    NULL
  ),
  (
    'c01e07-1111-2222-3333-444444444444', 
    'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e', 
    'Practice Guidelines', 
    'Best time to practice, how long beginners should practice, and daily practice routine.', 
    6, 
    'pdf', 
    '0.8MB', 
    'PDF • 0.8MB', 
    false, 
    false, 
    ARRAY['Best time to practice', 'How long beginners should practice', 'Daily practice routine'],
    'https://krishnaflute.com/routine'
  ),
  (
    'c01e08-1111-2222-3333-444444444444', 
    'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e', 
    'Flute Care & Maintenance', 
    'How to clean the flute, protection from moisture, and storage tips.', 
    7, 
    'pdf', 
    '0.6MB', 
    'PDF • 0.6MB', 
    false, 
    false, 
    ARRAY['How to clean the flute', 'Protection from moisture', 'Storage tips'],
    NULL
  ),
  (
    'c01e09-1111-2222-3333-444444444444', 
    'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e', 
    'Do’s and Don’ts', 
    'Correct handling, avoiding pressure on holes, and avoiding touching the inner surface.', 
    8, 
    'pdf', 
    '0.5MB', 
    'PDF • 0.5MB', 
    false, 
    false, 
    ARRAY['Correct handling', 'Avoiding pressure on holes', 'Avoid touching inner surface'],
    NULL
  ),
  (
    'c01e10-1111-2222-3333-444444444444', 
    'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e', 
    'Food and Practice', 
    'Playing on empty stomach vs after food, and recommended gap after eating.', 
    9, 
    'pdf', 
    '0.4MB', 
    'PDF • 0.4MB', 
    false, 
    false, 
    ARRAY['Playing on empty stomach vs after food', 'Recommended gap after eating'],
    NULL
  ),
  (
    'c02e01-1111-2222-3333-444444444444', 
    'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f', 
    'First Blow – Producing the Sound', 
    'Understanding how to blow into the flute, lip position (embouchure), and producing the first clear sound.', 
    1, 
    'video', 
    NULL, 
    'VIDEO • 10:15', 
    false, 
    false, 
    ARRAY['Understanding how to blow into the flute', 'Lip position (embouchure)', 'Producing the first clear sound'],
    NULL
  ),
  (
    'c02e02-1111-2222-3333-444444444444', 
    'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f', 
    'First Note – Tivra Ma', 
    'All holes open, producing a stable sound, and holding the note for longer duration.', 
    2, 
    'pdf', 
    '0.8MB', 
    'PDF • 0.8MB', 
    false, 
    false, 
    ARRAY['All holes open', 'Producing a stable sound', 'Holding the note for longer duration'],
    NULL
  ),
  (
    'c02e03-1111-2222-3333-444444444444', 
    'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f', 
    'Learning the First Four Notes', 
    'Tivra Ma (all holes open), Ga (close bottom hole), Re (close two holes), and Sa (close three holes). Practice slowly to develop finger control.', 
    3, 
    'pdf', 
    '1.1MB', 
    'PDF • 1.1MB', 
    false, 
    false, 
    ARRAY['Tivra Ma – all holes open', 'Ga – close the bottom hole', 'Re – close two holes', 'Sa – close three holes'],
    NULL
  ),
  (
    'c02e04-1111-2222-3333-444444444444', 
    'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f', 
    'Understanding Rhythm – 4/4', 
    'Introduction to 4/4 rhythm (Teentaal counting style for beginners), using a metronome, and counting: 1 – 2 – 3 – 4.', 
    4, 
    'video', 
    NULL, 
    'VIDEO • 08:45', 
    false, 
    false, 
    ARRAY['Introduction to 4/4 rhythm (Teentaal style)', 'Using a metronome', 'Counting: 1 – 2 – 3 – 4'],
    NULL
  ),
  (
    'c02e05-1111-2222-3333-444444444444', 
    'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f', 
    'Note Repetition Exercise', 
    'Practice each note (Ma, Ga, Re, Sa) with a metronome at 8, 4, 2, and 1 beats each. Sequence: Ma Ma Ma Ma, Ga Ga Ga Ga, Re Re Re Re, Sa Sa Sa Sa. Builds breath control and timing.', 
    5, 
    'pdf', 
    '0.7MB', 
    'PDF • 0.7MB', 
    false, 
    false, 
    ARRAY['Practice 8, 4, 2, and 1 beats each', 'Sequence: Ma Ma Ma Ma, Ga Ga Ga Ga...', 'Builds breath control and timing'],
    NULL
  ),
  (
    'c02e06-1111-2222-3333-444444444444', 
    'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f', 
    'Ascending and Descending Practice', 
    'Practice note movements: Sa Re Ga Ma, Ma Ga Re Sa to develop finger coordination.', 
    6, 
    'video', 
    NULL, 
    'VIDEO • 06:30', 
    false, 
    false, 
    ARRAY['Ascending: Sa Re Ga Ma', 'Descending: Ma Ga Re Sa', 'Develops finger coordination'],
    NULL
  ),
  (
    'c02e07-1111-2222-3333-444444444444', 
    'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f', 
    'Long Note Practice', 
    'Students should hold each note for 4–6 beats to improve breath control, tone quality, and stability of sound.', 
    7, 
    'video', 
    NULL, 
    'VIDEO • 12:00', 
    false, 
    true, 
    ARRAY['Hold each note for 4-6 beats', 'Improves breath control & tone quality', 'Builds stability of sound'],
    NULL
  ),
  (
    'c02e08-1111-2222-3333-444444444444', 
    'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f', 
    'Simple Compositions & Pyramid', 
    'Play small musical phrases (Sa Re Ga Re Sa, Sa Re Ga Ma, Ma Ga Re Sa) and master the note pyramid (S, SRS, SRGRS, SRGMGRS) to improve note transitions.', 
    8, 
    'pdf', 
    '0.9MB', 
    'PDF • 0.9MB', 
    false, 
    false, 
    ARRAY['Patterns: Sa Re Ga Re Sa, Sa Re Ga Ma...', 'Pyramid: S, SRS, SRGRS, SRGMGRS', 'Improves note transition & understanding'],
    NULL
  )
ON CONFLICT (id) DO NOTHING;
