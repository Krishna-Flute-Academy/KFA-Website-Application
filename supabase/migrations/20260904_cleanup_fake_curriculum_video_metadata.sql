-- Migration: Cleanup fake video metadata from course_lessons
-- Description:
-- 1. Updates lessons marked with material_type = 'video' that have NO actual video URL/attachment.
--    - If link_url is present (reference webpage), sets material_type = 'link'.
--    - If no material_url and no link_url, sets material_type = 'note'.
-- 2. Clears fake duration strings (e.g. 'VIDEO • 08:20') from lessons without real video sources.
-- 3. Strictly preserves lesson descriptions, chapter mappings, ordering, bullet points, student allocations, and progress.

-- Step 1: Set material_type = 'link' for lessons previously tagged as 'video' with only external reference web links
UPDATE public.course_lessons
SET 
  material_type = 'link',
  updated_at = now()
WHERE 
  material_type = 'video'
  AND (material_url IS NULL OR trim(material_url) = '' OR trim(material_url) = 'null')
  AND link_url IS NOT NULL 
  AND trim(link_url) != '' 
  AND trim(link_url) != 'null'
  AND link_url NOT ILIKE '%youtube.com%'
  AND link_url NOT ILIKE '%youtu.be%'
  AND link_url NOT ILIKE '%vimeo.com%'
  AND link_url NOT ILIKE '%.mp4%'
  AND link_url NOT ILIKE '%.webm%'
  AND link_url NOT ILIKE '%.ogv%'
  AND link_url NOT ILIKE '%.mov%';

-- Step 2: Set material_type = 'note' for lessons previously tagged as 'video' with no media and no links
UPDATE public.course_lessons
SET 
  material_type = 'note',
  updated_at = now()
WHERE 
  material_type = 'video'
  AND (material_url IS NULL OR trim(material_url) = '' OR trim(material_url) = 'null')
  AND (link_url IS NULL OR trim(link_url) = '' OR trim(link_url) = 'null');

-- Step 3: Clear fake duration strings ('VIDEO • %') on lessons that do NOT have real video attachments or video URLs
UPDATE public.course_lessons
SET 
  duration = NULL,
  updated_at = now()
WHERE 
  duration LIKE 'VIDEO • %'
  AND (
    material_url IS NULL 
    OR (
      material_url NOT ILIKE '%.mp4%' 
      AND material_url NOT ILIKE '%.webm%' 
      AND material_url NOT ILIKE '%.ogv%' 
      AND material_url NOT ILIKE '%.mov%'
      AND material_url NOT ILIKE '%youtube.com%'
      AND material_url NOT ILIKE '%youtu.be%'
      AND material_url NOT ILIKE '%vimeo.com%'
    )
  )
  AND (
    link_url IS NULL 
    OR (
      link_url NOT ILIKE '%youtube.com%' 
      AND link_url NOT ILIKE '%youtu.be%' 
      AND link_url NOT ILIKE '%vimeo.com%'
      AND link_url NOT ILIKE '%.mp4%' 
      AND link_url NOT ILIKE '%.webm%' 
      AND link_url NOT ILIKE '%.ogv%' 
      AND link_url NOT ILIKE '%.mov%'
    )
  );
