-- 1. Clean up potential orphans in public.classroom_inventory_allocation
DELETE FROM public.classroom_inventory_allocation 
WHERE (allocated_to_student_id IS NOT NULL AND allocated_to_student_id NOT IN (SELECT id FROM public.users))
   OR (allocated_by IS NOT NULL AND allocated_by NOT IN (SELECT id FROM public.users));

-- 2. Drop and recreate constraints on classroom_inventory_allocation with cascading
ALTER TABLE public.classroom_inventory_allocation
  DROP CONSTRAINT IF EXISTS classroom_inventory_assignments_assigned_by_fkey,
  DROP CONSTRAINT IF EXISTS classroom_inventory_assignments_assigned_to_student_id_fkey;

ALTER TABLE public.classroom_inventory_allocation
  ADD CONSTRAINT classroom_inventory_assignments_assigned_by_fkey
    FOREIGN KEY (allocated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT classroom_inventory_assignments_assigned_to_student_id_fkey
    FOREIGN KEY (allocated_to_student_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 3. Clean up orphans in public.assignment_students
DELETE FROM public.assignment_students
WHERE student_id NOT IN (SELECT id FROM public.users)
   OR assignment_id NOT IN (SELECT id FROM public.assignments);

-- 4. Add constraints to public.assignment_students
ALTER TABLE public.assignment_students
  DROP CONSTRAINT IF EXISTS assignment_students_student_id_fkey,
  DROP CONSTRAINT IF EXISTS assignment_students_assignment_id_fkey;

ALTER TABLE public.assignment_students
  ADD CONSTRAINT assignment_students_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT assignment_students_assignment_id_fkey
    FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;

-- 5. Clean up orphans in public.assignments
DELETE FROM public.assignments
WHERE classroom_id NOT IN (SELECT id FROM public.classrooms)
   OR teacher_id NOT IN (SELECT id FROM public.users);

-- 6. Add constraints to public.assignments
ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_classroom_id_fkey,
  DROP CONSTRAINT IF EXISTS assignments_teacher_id_fkey;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_classroom_id_fkey
    FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE,
  ADD CONSTRAINT assignments_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 7. Clean up orphans in public.class_notes
DELETE FROM public.class_notes
WHERE classroom_id NOT IN (SELECT id FROM public.classrooms)
   OR teacher_id NOT IN (SELECT id FROM public.users);

-- 8. Add constraints to public.class_notes
ALTER TABLE public.class_notes
  DROP CONSTRAINT IF EXISTS class_notes_classroom_id_fkey,
  DROP CONSTRAINT IF EXISTS class_notes_teacher_id_fkey;

ALTER TABLE public.class_notes
  ADD CONSTRAINT class_notes_classroom_id_fkey
    FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE,
  ADD CONSTRAINT class_notes_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 9. Create Trigger Function to delete auth.users when public.users profile is deleted
CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_public_user_deleted ON public.users;
CREATE TRIGGER on_public_user_deleted
  AFTER DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_user();

-- 10. Create Trigger Function to delete public.users profile when auth.users is deleted (fallback)
CREATE OR REPLACE FUNCTION public.handle_deleted_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_auth_user();
