-- Migration: Add Archived/Inactive Student Status and KFA Learning Circle handling

-- 1. Drop existing users_status_check constraint if it exists and recreate to allow 'active', 'inactive', 'archived'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_status_check;
  END IF;
END $$;

ALTER TABLE public.users
  ADD CONSTRAINT users_status_check 
  CHECK (status IN ('active', 'inactive', 'archived'));

-- 2. Ensure "KFA Learning Circle" classroom exists in public.classrooms
INSERT INTO public.classrooms (id, name, type, description, status)
SELECT 
  gen_random_uuid(), 
  'KFA Learning Circle', 
  'learning_circle', 
  'Community & Self-Paced Learning Circle for KFA Alumni & Inactive Students', 
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM public.classrooms WHERE LOWER(TRIM(name)) = LOWER(TRIM('KFA Learning Circle'))
);

-- 3. Create function to automatically reassign archived/inactive student to KFA Learning Circle
CREATE OR REPLACE FUNCTION public.handle_student_archival()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_learning_circle_id UUID;
BEGIN
  -- Trigger runs when student status changes to 'archived' or 'inactive'
  IF (NEW.status = 'archived' OR NEW.status = 'inactive') AND (OLD.status IS NULL OR OLD.status = 'active') THEN
    
    -- Fetch KFA Learning Circle classroom ID
    SELECT id INTO v_learning_circle_id 
    FROM public.classrooms 
    WHERE LOWER(TRIM(name)) = LOWER(TRIM('KFA Learning Circle')) 
    LIMIT 1;

    IF v_learning_circle_id IS NOT NULL THEN
      -- Reassign student in classroom_students table
      IF EXISTS (SELECT 1 FROM public.classroom_students WHERE student_id = NEW.id) THEN
        UPDATE public.classroom_students
        SET classroom_id = v_learning_circle_id,
            joined_at = now()
        WHERE student_id = NEW.id;
      ELSE
        INSERT INTO public.classroom_students (classroom_id, student_id, joined_at)
        VALUES (v_learning_circle_id, NEW.id, now());
      END IF;

      -- Remove temporary session overrides if any
      DELETE FROM public.session_student_overrides WHERE student_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Bind trigger to users table for status updates
DROP TRIGGER IF EXISTS trg_student_archival ON public.users;
CREATE TRIGGER trg_student_archival
  AFTER UPDATE OF status ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_student_archival();
