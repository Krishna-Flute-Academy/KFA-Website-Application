-- Migration: Add Student Dashboard Notification Triggers for Key Events

-- Adjust check constraint on notifications type column to allow new notification categories
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN ('reminder', 'live_class', 'messages', 'tasks', 'task', 'classroom', 'curriculum', 'attendance', 'fees')
);

-- 1. Trigger for Classroom Enrollment (classroom_students AFTER INSERT)
CREATE OR REPLACE FUNCTION public.notify_student_enrolled()
RETURNS TRIGGER AS $$
DECLARE
  v_classroom_name TEXT;
  v_already_notified BOOLEAN;
  v_title TEXT;
  v_message TEXT;
BEGIN
  -- Get classroom name
  SELECT name INTO v_classroom_name
  FROM public.classrooms
  WHERE id = NEW.classroom_id;

  IF v_classroom_name IS NOT NULL THEN
    v_title := 'Added to Classroom';
    v_message := 'You have been added to the classroom "' || v_classroom_name || '".';

    -- Check for duplicate within last 10 seconds
    SELECT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = NEW.student_id
        AND title = v_title
        AND message = v_message
        AND created_at > now() - interval '10 seconds'
    ) INTO v_already_notified;

    IF NOT v_already_notified THEN
      INSERT INTO public.notifications (user_id, title, message, type, is_read)
      VALUES (NEW.student_id, v_title, v_message, 'classroom', false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_student_enrolled_notification ON public.classroom_students;
CREATE TRIGGER trg_student_enrolled_notification
  AFTER INSERT ON public.classroom_students
  FOR EACH ROW EXECUTE FUNCTION public.notify_student_enrolled();


-- 2. Trigger for Chapter Unlocking (student_topic_progress AFTER INSERT OR UPDATE)
CREATE OR REPLACE FUNCTION public.notify_chapter_unlocked()
RETURNS TRIGGER AS $$
DECLARE
  v_chapter_id UUID;
  v_chapter_title TEXT;
  v_already_notified BOOLEAN;
  v_title TEXT;
  v_message TEXT;
BEGIN
  -- We only notify if the status becomes 'unlocked'
  IF NEW.status = 'unlocked' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status)) THEN
    -- Get the chapter of the lesson
    SELECT chapter_id INTO v_chapter_id
    FROM public.course_lessons
    WHERE id = NEW.lesson_id;

    IF v_chapter_id IS NOT NULL THEN
      SELECT title INTO v_chapter_title
      FROM public.course_chapters
      WHERE id = v_chapter_id;

      IF v_chapter_title IS NOT NULL THEN
        v_title := 'Chapter Unlocked';
        v_message := 'A new chapter has been unlocked for you: "' || v_chapter_title || '".';

        -- Check if we already notified about this chapter recently (debounce bulk unlocks)
        SELECT EXISTS (
          SELECT 1 FROM public.notifications
          WHERE user_id = NEW.student_id
            AND title = v_title
            AND message = v_message
            AND created_at > now() - interval '10 seconds'
        ) INTO v_already_notified;

        IF NOT v_already_notified THEN
          INSERT INTO public.notifications (user_id, title, message, type, is_read)
          VALUES (NEW.student_id, v_title, v_message, 'curriculum', false);
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_chapter_unlocked_notification ON public.student_topic_progress;
CREATE TRIGGER trg_chapter_unlocked_notification
  AFTER INSERT OR UPDATE ON public.student_topic_progress
  FOR EACH ROW EXECUTE FUNCTION public.notify_chapter_unlocked();


-- 3. Trigger for Task Assignment and Review (assignment_students AFTER INSERT OR UPDATE)
CREATE OR REPLACE FUNCTION public.notify_task_review()
RETURNS TRIGGER AS $$
DECLARE
  v_task_title TEXT;
  v_already_notified BOOLEAN;
  v_title TEXT;
  v_message TEXT;
BEGIN
  -- Get assignment title
  SELECT title INTO v_task_title
  FROM public.assignments
  WHERE id = NEW.assignment_id;

  IF v_task_title IS NOT NULL THEN
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
      v_title := 'New Task Assigned';
      v_message := 'You have been assigned a new task: "' || v_task_title || '".';
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'approved' THEN
        v_title := '✅ Task Approved: ' || v_task_title;
        v_message := 'Your submission for "' || v_task_title || '" has been approved!' || COALESCE(' Score: ' || NEW.score || '/10.', '');
      ELSIF NEW.status = 'reviewed' THEN
        v_title := '📝 Task Needs Revision: ' || v_task_title;
        v_message := 'Your submission for "' || v_task_title || '" has been reviewed and needs revision.' || COALESCE(' Feedback: "' || NEW.feedback_text || '"', '');
      END IF;
    END IF;

    IF v_title IS NOT NULL THEN
      -- Check for duplicate within last 10 seconds
      SELECT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = NEW.student_id
          AND title = v_title
          AND message = v_message
          AND created_at > now() - interval '10 seconds'
      ) INTO v_already_notified;

      IF NOT v_already_notified THEN
        INSERT INTO public.notifications (user_id, title, message, type, is_read)
        VALUES (NEW.student_id, v_title, v_message, 'task', false);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_task_review_notification ON public.assignment_students;
CREATE TRIGGER trg_task_review_notification
  AFTER INSERT OR UPDATE ON public.assignment_students
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_review();


-- 4. Trigger for Attendance Marked (attendance AFTER INSERT OR UPDATE)
CREATE OR REPLACE FUNCTION public.notify_attendance_marked()
RETURNS TRIGGER AS $$
DECLARE
  v_classroom_name TEXT;
  v_already_notified BOOLEAN;
  v_title TEXT;
  v_message TEXT;
  v_status_pretty TEXT;
BEGIN
  -- Get classroom name
  SELECT name INTO v_classroom_name
  FROM public.classrooms
  WHERE id = NEW.classroom_id;

  IF v_classroom_name IS NOT NULL THEN
    v_status_pretty := INITCAP(NEW.status);
    v_title := 'Attendance Marked: ' || v_status_pretty;
    v_message := 'Your attendance for "' || v_classroom_name || '" on ' || NEW.date::text || ' has been marked as ' || v_status_pretty || '.';

    -- Check for duplicate within last 10 seconds
    SELECT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = NEW.student_id
        AND title = v_title
        AND message = v_message
        AND created_at > now() - interval '10 seconds'
    ) INTO v_already_notified;

    IF NOT v_already_notified THEN
      INSERT INTO public.notifications (user_id, title, message, type, is_read)
      VALUES (NEW.student_id, v_title, v_message, 'attendance', false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_attendance_marked_notification ON public.attendance;
CREATE TRIGGER trg_attendance_marked_notification
  AFTER INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.notify_attendance_marked();


-- 5. Trigger for Fees Payment Approval (fees_payments AFTER UPDATE)
CREATE OR REPLACE FUNCTION public.notify_fees_approved()
RETURNS TRIGGER AS $$
DECLARE
  v_already_notified BOOLEAN;
  v_title TEXT;
  v_message TEXT;
BEGIN
  -- We only notify if status goes from something else to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    v_title := 'Fees Payment Approved';
    v_message := 'Your fee payment of ' || COALESCE('₹' || NEW.amount::text, 'amount') || ' has been approved by the admin.' 
      || COALESCE(' ' || NEW.classes_added || ' classes have been added to your balance.', '');

    -- Check for duplicate within last 10 seconds
    SELECT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = NEW.student_id
        AND title = v_title
        AND message = v_message
        AND created_at > now() - interval '10 seconds'
    ) INTO v_already_notified;

    IF NOT v_already_notified THEN
      INSERT INTO public.notifications (user_id, title, message, type, is_read)
      VALUES (NEW.student_id, v_title, v_message, 'fees', false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_fees_approved_notification ON public.fees_payments;
CREATE TRIGGER trg_fees_approved_notification
  AFTER UPDATE ON public.fees_payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_fees_approved();
