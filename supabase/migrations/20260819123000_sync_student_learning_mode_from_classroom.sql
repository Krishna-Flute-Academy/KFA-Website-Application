-- ============================================================
-- Migration: Auto-sync Student learning_mode from Classroom
-- Description: Sets users.learning_mode to 'offline' if assigned to an offline classroom, or 'online' if assigned to an online classroom.
-- ============================================================

-- 1. One-time update of all existing student learning_mode based on assigned classroom
UPDATE public.users u
SET learning_mode = CASE 
    WHEN c.name ILIKE '%offline%' OR c.description ILIKE '%offline%' THEN 'offline'
    WHEN c.name ILIKE '%online%' OR c.description ILIKE '%online%' THEN 'online'
    ELSE COALESCE(u.learning_mode, 'online')
END
FROM public.classroom_students cs
JOIN public.classrooms c ON c.id = cs.classroom_id
WHERE u.id = cs.student_id;

-- 2. Trigger function when a student is linked/re-assigned to a classroom in classroom_students
CREATE OR REPLACE FUNCTION sync_student_learning_mode_from_classroom()
RETURNS TRIGGER AS $$
DECLARE
    v_classroom_name TEXT;
    v_classroom_desc TEXT;
    v_mode TEXT := 'online';
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        SELECT name, description INTO v_classroom_name, v_classroom_desc
        FROM public.classrooms
        WHERE id = NEW.classroom_id;

        IF (v_classroom_name ILIKE '%offline%' OR v_classroom_desc ILIKE '%offline%') THEN
            v_mode := 'offline';
        ELSIF (v_classroom_name ILIKE '%online%' OR v_classroom_desc ILIKE '%online%') THEN
            v_mode := 'online';
        END IF;

        UPDATE public.users
        SET learning_mode = v_mode
        WHERE id = NEW.student_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_student_learning_mode ON public.classroom_students;
CREATE TRIGGER trg_sync_student_learning_mode
AFTER INSERT OR UPDATE ON public.classroom_students
FOR EACH ROW EXECUTE FUNCTION sync_student_learning_mode_from_classroom();

-- 3. Trigger function when a classroom name or description is updated
CREATE OR REPLACE FUNCTION sync_all_students_learning_mode_on_classroom_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.name ILIKE '%offline%' OR NEW.description ILIKE '%offline%') THEN
        UPDATE public.users
        SET learning_mode = 'offline'
        FROM public.classroom_students cs
        WHERE cs.classroom_id = NEW.id AND public.users.id = cs.student_id;
    ELSIF (NEW.name ILIKE '%online%' OR NEW.description ILIKE '%online%') THEN
        UPDATE public.users
        SET learning_mode = 'online'
        FROM public.classroom_students cs
        WHERE cs.classroom_id = NEW.id AND public.users.id = cs.student_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_classroom_students_learning_mode ON public.classrooms;
CREATE TRIGGER trg_sync_classroom_students_learning_mode
AFTER UPDATE OF name, description ON public.classrooms
FOR EACH ROW EXECUTE FUNCTION sync_all_students_learning_mode_on_classroom_update();
