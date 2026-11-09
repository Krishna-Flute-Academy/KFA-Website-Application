-- =====================================================================================
-- KFA Migration: Add audio_url to course_lessons
-- Version: 20261107180000
-- =====================================================================================
-- Purpose:
-- Separate file attachments (material_url) and live recorded audio guides (audio_url)
-- so both can co-exist on curriculum topic materials without overwriting each other.
-- =====================================================================================

BEGIN;

ALTER TABLE public.course_lessons
    ADD COLUMN IF NOT EXISTS audio_url text;

COMMENT ON COLUMN public.course_lessons.audio_url IS 'URL for recorded voice/audio guide or demo separate from the main file attachment';

COMMIT;
