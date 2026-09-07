-- ============================================================
-- SAFE Migration: Add Student Curriculum Spotlights
-- Purpose: Supports Teacher Spotlight (⭐) and My Spotlight (★)
-- Maximum 1 active Teacher Spotlight and 1 Student Spotlight per student
-- Target: AUTH Supabase project
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_curriculum_spotlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
    spotlight_type TEXT NOT NULL CHECK (spotlight_type IN ('teacher', 'student')),
    recommended_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    recommended_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (student_id, spotlight_type)
);

-- Index for fast lookup by student_id
CREATE INDEX IF NOT EXISTS idx_student_spotlights_student 
    ON public.student_curriculum_spotlights(student_id);

CREATE INDEX IF NOT EXISTS idx_student_spotlights_lesson
    ON public.student_curriculum_spotlights(lesson_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.student_curriculum_spotlights ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DROP POLICY IF EXISTS "Users can view relevant spotlights" ON public.student_curriculum_spotlights;
DROP POLICY IF EXISTS "Users can insert allowed spotlights" ON public.student_curriculum_spotlights;
DROP POLICY IF EXISTS "Users can update allowed spotlights" ON public.student_curriculum_spotlights;
DROP POLICY IF EXISTS "Users can delete allowed spotlights" ON public.student_curriculum_spotlights;
DROP POLICY IF EXISTS "Allow all student_curriculum_spotlights" ON public.student_curriculum_spotlights;

-- Create unified policy matching student_topic_progress
CREATE POLICY "Allow all student_curriculum_spotlights" 
    ON public.student_curriculum_spotlights 
    USING (true) 
    WITH CHECK (true);

-- Grant table permissions
GRANT ALL ON TABLE public.student_curriculum_spotlights TO anon;
GRANT ALL ON TABLE public.student_curriculum_spotlights TO authenticated;
GRANT ALL ON TABLE public.student_curriculum_spotlights TO service_role;

-- Enable Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'student_curriculum_spotlights'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.student_curriculum_spotlights;
    END IF;
END $$;
