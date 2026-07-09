-- Migration: Update update_prepaid_classes_on_attendance trigger function
-- Deduct credit when attendance status is 'present', 'late', OR 'absent'.
-- Do NOT deduct credit when attendance status is 'excused' (enabling alternative class rescheduling).

CREATE OR REPLACE FUNCTION update_prepaid_classes_on_attendance()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status IN ('present', 'late', 'absent') THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) - 1 
            WHERE id = NEW.student_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Transition from deducting to non-deducting (e.g. excused)
        IF OLD.status IN ('present', 'late', 'absent') AND NEW.status NOT IN ('present', 'late', 'absent') THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + 1 
            WHERE id = NEW.student_id;
        -- Transition from non-deducting to deducting
        ELSIF OLD.status NOT IN ('present', 'late', 'absent') AND NEW.status IN ('present', 'late', 'absent') THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) - 1 
            WHERE id = NEW.student_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('present', 'late', 'absent') THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + 1 
            WHERE id = OLD.student_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
