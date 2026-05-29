-- ============================================================
-- SAFE Migration: Add Student Topic Progress Tracking
-- Target: AUTH Supabase project
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_topic_progress (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    classroom_id  UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    lesson_id     UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
    
    -- State indicators
    status        TEXT NOT NULL DEFAULT 'locked', -- 'locked', 'unlocked', 'completed'
    unlocked_by   TEXT NOT NULL DEFAULT 'system', -- 'system' (inherited), 'manual' (teacher override)
    
    unlocked_at   TIMESTAMPTZ DEFAULT now(),
    completed_at  TIMESTAMPTZ,
    
    UNIQUE (student_id, lesson_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.student_topic_progress ENABLE ROW LEVEL SECURITY;

-- Allow all policy
DROP POLICY IF EXISTS "Allow all student_topic_progress" ON public.student_topic_progress;
CREATE POLICY "Allow all student_topic_progress"
  ON public.student_topic_progress FOR ALL
  USING (true) WITH CHECK (true);
