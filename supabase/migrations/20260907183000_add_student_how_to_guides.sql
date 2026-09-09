-- Migration: Add student_how_to_guides table with UUID PK, unique slug, and strict RLS
-- Description: Interactive tutorial and how-to guides for student portal actions (leave, task submission, etc.)
-- NOTE: Does NOT create or alter public.academy_policies as it already exists in production.

-- 1. Create table with UUID PK, unique slug, check constraint, and FK to existing academy_policies
CREATE TABLE IF NOT EXISTS public.student_how_to_guides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    video_url TEXT,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    related_policy_id TEXT REFERENCES public.academy_policies(id) ON DELETE SET NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT student_how_to_guides_steps_is_array CHECK (jsonb_typeof(steps) = 'array')
);

-- Safe migration in case a previous draft created id as TEXT in any local testing environment
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'student_how_to_guides' 
          AND column_name = 'id' 
          AND data_type = 'text'
    ) THEN
        -- Add slug column if it does not exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'student_how_to_guides' 
              AND column_name = 'slug'
        ) THEN
            ALTER TABLE public.student_how_to_guides ADD COLUMN slug TEXT;
            UPDATE public.student_how_to_guides SET slug = id WHERE slug IS NULL;
            ALTER TABLE public.student_how_to_guides ALTER COLUMN slug SET NOT NULL;
            ALTER TABLE public.student_how_to_guides ADD CONSTRAINT uq_student_how_to_guides_slug UNIQUE (slug);
        END IF;

        -- Safely convert id to UUID
        ALTER TABLE public.student_how_to_guides DROP CONSTRAINT IF EXISTS student_how_to_guides_pkey CASCADE;
        ALTER TABLE public.student_how_to_guides ADD COLUMN new_uuid_id UUID DEFAULT gen_random_uuid();
        ALTER TABLE public.student_how_to_guides DROP COLUMN id;
        ALTER TABLE public.student_how_to_guides RENAME COLUMN new_uuid_id TO id;
        ALTER TABLE public.student_how_to_guides ADD PRIMARY KEY (id);
    END IF;
END $$;

-- 2. Indexes for ordering and policy lookup
CREATE INDEX IF NOT EXISTS idx_student_how_to_guides_active_order 
ON public.student_how_to_guides (is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_student_how_to_guides_related_policy 
ON public.student_how_to_guides (related_policy_id);

-- 3. Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_student_how_to_guides_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_how_to_guides_updated_at ON public.student_how_to_guides;
CREATE TRIGGER trg_student_how_to_guides_updated_at
BEFORE UPDATE ON public.student_how_to_guides
FOR EACH ROW
EXECUTE FUNCTION public.set_student_how_to_guides_updated_at();

-- 4. Enable Row Level Security
ALTER TABLE public.student_how_to_guides ENABLE ROW LEVEL SECURITY;

-- 4a. Admin: Full management access (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Admins have full access to student_how_to_guides" ON public.student_how_to_guides;
DROP POLICY IF EXISTS "Allow admin manage student how to guides" ON public.student_how_to_guides;
CREATE POLICY "Admins have full access to student_how_to_guides"
ON public.student_how_to_guides
FOR ALL
TO authenticated
USING (
    public.is_admin()
)
WITH CHECK (
    public.is_admin()
);

-- 4b. Student: Read active guides only (Strict: role must be 'student')
DROP POLICY IF EXISTS "Students can view active student_how_to_guides" ON public.student_how_to_guides;
DROP POLICY IF EXISTS "Allow read active student how to guides" ON public.student_how_to_guides;
CREATE POLICY "Students can view active student_how_to_guides"
ON public.student_how_to_guides
FOR SELECT
TO authenticated
USING (
    is_active = true 
    AND EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = (SELECT auth.uid()) 
        AND users.role = 'student'
    )
);

-- 5. Seed initial verified how-to guides
-- Note: Leave guide references real 'attendance' policy; Task guide has related_policy_id = NULL
INSERT INTO public.student_how_to_guides (slug, title, description, video_url, steps, related_policy_id, display_order, is_active)
VALUES 
(
    'how-to-apply-leave',
    'How to Apply for Leave',
    'Learn how to inform KFA and request an excused absence when you cannot attend a scheduled class.',
    NULL,
    '[
        {"order": 1, "text": "Open \"Attendance & Leave\" from the student dashboard navigation menu."},
        {"order": 2, "text": "Click the \"Inform Absence / Request Excuse\" button in the tracker header (or click \"Apply for Excuse\" on an upcoming class alert banner)."},
        {"order": 3, "text": "In the \"Class Leave Request\" modal, select your Absence Date (leaves can only be requested for dates with a scheduled class, at least 24 hours in advance)."},
        {"order": 4, "text": "Enter your Reason / Notes in the text field explaining why you will be unable to attend."},
        {"order": 5, "text": "Click \"Submit Excuse Request\" to log your absence with the academy."},
        {"order": 6, "text": "Your request starts with \"Pending\" status. Once reviewed and approved by your teacher or admin, it records an \"Excused Absence\" on your calendar. You may then coordinate for an alternative/makeup slot subject to teacher availability and current academy policy rules (makeup classes are not guaranteed and must be completed within the current billing cycle)."}
    ]'::jsonb,
    'attendance',
    1,
    true
),
(
    'how-to-submit-task',
    'How to Submit a Task',
    'Choose your preferred submission method: YouTube unlisted link, Google Drive shared link, or upload via the portal.',
    NULL,
    '[
        {
            "key": "youtube",
            "title": "YouTube — Unlisted Video",
            "shortTitle": "YouTube Unlisted",
            "description": "Fastest method. Upload to YouTube, set to Unlisted, and paste the video link.",
            "badge": "Recommended",
            "iconName": "youtube",
            "requiresTeacherAccess": false,
            "steps": [
                {"order": 1, "text": "Record your flute practice on your phone or camera."},
                {"order": 2, "text": "Open YouTube (or the YouTube mobile app) and select \"Upload Video\"."},
                {"order": 3, "text": "Set video visibility to \"Unlisted\". (IMPORTANT: Do NOT choose \"Private\", or the teacher will not be able to open or evaluate your video)."},
                {"order": 4, "text": "Publish the upload and tap \"Copy Link\" to copy your video URL."},
                {"order": 5, "text": "Return to the KFA Student Dashboard and open \"Tasks & Submissions\"."},
                {"order": 6, "text": "Select your assigned task and click the \"Submit\" (or \"Resubmit\") button."},
                {"order": 7, "text": "In the submission window, ensure the \"Provide Link\" tab is selected and paste your copied YouTube URL."},
                {"order": 8, "text": "Click \"Submit Recording\". Your task status immediately updates to \"Submitted\"."}
            ],
            "importantNote": "Why \"Unlisted\"? An unlisted YouTube video does NOT appear on your public channel or in search results. Anyone without the exact link cannot find it, keeping your riyaaz private while enabling your KFA instructor to review it."
        },
        {
            "key": "google-drive",
            "title": "Google Drive — Shared Folder/File",
            "shortTitle": "Google Drive",
            "description": "Upload to your Google Drive and share viewing permission with the teacher.",
            "badge": "Access Required",
            "iconName": "drive",
            "requiresTeacherAccess": true,
            "teacherEmail": "kgbhaumik86@gmail.com",
            "steps": [
                {"order": 1, "text": "Open Google Drive (drive.google.com)."},
                {"order": 2, "text": "Create a folder preferably named: \"KFA TASK SUBMISSION - [Your Name]\" (or locate your recorded video file)."},
                {"order": 3, "text": "Upload your practice recording file into this folder."},
                {"order": 4, "text": "Right-click the folder or file, select \"Share\" → \"Share\"."},
                {"order": 5, "text": "In the \"Add people\" box, enter teacher email: kgbhaumik86@gmail.com"},
                {"order": 6, "text": "Ensure the permission role is set to \"Viewer\" and click \"Send\" or \"Done\" to grant access."},
                {"order": 7, "text": "Click \"Copy Link\" to copy the Google Drive share link."},
                {"order": 8, "text": "Open \"Tasks & Submissions\" in the KFA portal, click on your task, and click \"Submit\" (or \"Resubmit\")."},
                {"order": 9, "text": "Select the \"Provide Link\" tab, paste your Google Drive URL into the link box, and click \"Submit Recording\"."}
            ],
            "importantNote": "IMPORTANT: Pasting a Google Drive link alone does NOT automatically grant permission. You must explicitly share the file or folder with kgbhaumik86@gmail.com, otherwise the instructor will receive an \"Access Denied\" error and cannot grade your assignment."
        },
        {
            "key": "portal-upload",
            "title": "Upload from Portal (Google Drive Picker)",
            "shortTitle": "Upload from Portal",
            "description": "Select your recording file directly through the portal submission modal using the Google Drive Picker.",
            "badge": "Access Required",
            "iconName": "upload",
            "requiresTeacherAccess": true,
            "teacherEmail": "kgbhaumik86@gmail.com",
            "steps": [
                {"order": 1, "text": "Open \"Tasks & Submissions\" from the student dashboard menu."},
                {"order": 2, "text": "Click on your assigned task card to view the brief and Sargam notation notes."},
                {"order": 3, "text": "Click the \"Submit\" (or \"Resubmit\") button to open the submission window."},
                {"order": 4, "text": "In the modal, click the \"Upload Video\" tab (located right next to \"Provide Link\")."},
                {"order": 5, "text": "Click \"Open Google Drive Picker\" and authorize your Google account if prompted."},
                {"order": 6, "text": "Browse and select your practice recording video file from Google Drive."},
                {"order": 7, "text": "The selected file name and size will attach to the submission modal."},
                {"order": 8, "text": "Ensure Teacher Access: The portal attaches your file URL, but does NOT alter your Drive permissions. Verify that your file is shared with kgbhaumik86@gmail.com on Google Drive."},
                {"order": 9, "text": "Click \"Submit Recording\" to complete your submission."}
            ],
            "importantNote": "IMPORTANT: Selecting a file in the portal Drive Picker links the file to your assignment, but does NOT bypass Google Drive privacy settings. Always ensure kgbhaumik86@gmail.com has been granted viewing access in your Google Drive."
        }
    ]'::jsonb,
    NULL,
    2,
    true
)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    steps = EXCLUDED.steps,
    related_policy_id = EXCLUDED.related_policy_id,
    display_order = EXCLUDED.display_order,
    updated_at = now();
