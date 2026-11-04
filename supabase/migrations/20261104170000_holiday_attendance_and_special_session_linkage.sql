-- =====================================================================================
-- KFA Migration: Holiday Attendance Auto-Linkage & Special Session On-Behalf-Of Support
-- Version: 20261104170000
-- =====================================================================================
-- Purpose:
-- 1. Auto-populate attendance.on_behalf_of_date when attendance is recorded on an active
--    scheduled alternative date (holiday_type IN ('with_alternative', 'alternative_scheduled'))
--    for a classroom, ensuring BR-22 linkage even if the caller omits on_behalf_of_date.
-- 2. Allow Special Sessions (temporary classrooms) to record attendance on behalf of an
--    active scheduled holiday (on_behalf_of_date = holiday_date, date = alternative_date)
--    while preserving fail-closed protection against unscheduled/cancelled holidays and
--    preserving regular 5-occurrence-month (BR-28) on-behalf-of attendance.
-- 3. Extend fail-closed checks in schedule_holiday_alternative, revert_holiday_alternative_to_pending,
--    and cancel_classroom_holiday to also detect replacement attendance recorded via a
--    linked Special Session (temporary classroom) for enrolled students of that classroom.
-- =====================================================================================

BEGIN;

-- 1. Update compute_attendance_credit to auto-populate NEW.on_behalf_of_date on alternative_date
CREATE OR REPLACE FUNCTION public.compute_attendance_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_chargeable BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' AND NEW.on_behalf_of_date IS NULL AND NEW.classroom_id IS NOT NULL AND NEW.date IS NOT NULL THEN
        SELECT ch.holiday_date INTO NEW.on_behalf_of_date
        FROM public.classroom_holidays ch
        WHERE ch.classroom_id = NEW.classroom_id
          AND ch.alternative_date = NEW.date
          AND ch.status = 'active'
          AND ch.holiday_type IN ('with_alternative', 'alternative_scheduled')
        LIMIT 1;
    END IF;

    v_is_chargeable := public.is_attendance_chargeable(
        NEW.status,
        NEW.classroom_id,
        NEW.student_id,
        NEW.date,
        NEW.on_behalf_of_date
    );

    IF v_is_chargeable THEN
        NEW.credit_deducted := 1;
    ELSE
        NEW.credit_deducted := 0;
    END IF;

    NEW.is_makeup := EXISTS (
        SELECT 1
        FROM public.session_student_overrides sso
        WHERE sso.classroom_id = NEW.classroom_id
          AND sso.student_id = NEW.student_id
          AND sso.action = 'include'
          AND (sso.override_date IS NULL OR sso.override_date = NEW.date)
    );

    RETURN NEW;
END;
$$;

-- 2. Update prevent_attendance_on_holiday to support auto-linkage, Special Session replacement, and BR-28
CREATE OR REPLACE FUNCTION public.prevent_attendance_on_holiday()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_temp_classroom BOOLEAN := false;
    v_has_any_holiday_on_behalf BOOLEAN := false;
    v_has_valid_scheduled_alt BOOLEAN := false;
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.date IS DISTINCT FROM NEW.date OR OLD.on_behalf_of_date IS DISTINCT FROM NEW.on_behalf_of_date)) THEN
        -- Auto-populate on_behalf_of_date if inserting on an active scheduled alternative date for this classroom
        IF NEW.on_behalf_of_date IS NULL AND NEW.classroom_id IS NOT NULL AND NEW.date IS NOT NULL THEN
            SELECT ch.holiday_date INTO NEW.on_behalf_of_date
            FROM public.classroom_holidays ch
            WHERE ch.classroom_id = NEW.classroom_id
              AND ch.alternative_date = NEW.date
              AND ch.status = 'active'
              AND ch.holiday_type IN ('with_alternative', 'alternative_scheduled')
            LIMIT 1;
        END IF;

        -- Block attendance on original holiday date for active holidays
        IF EXISTS (
            SELECT 1 FROM public.classroom_holidays
            WHERE classroom_id = NEW.classroom_id
              AND holiday_date = NEW.date
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Cannot record attendance: % is declared as a holiday for this classroom.', NEW.date
                USING ERRCODE = '23514';
        END IF;

        -- Validate on_behalf_of_date if specified
        IF NEW.on_behalf_of_date IS NOT NULL AND NEW.on_behalf_of_date <> NEW.date THEN
            SELECT (c.type = 'temporary') INTO v_is_temp_classroom
            FROM public.classrooms c
            WHERE c.id = NEW.classroom_id;

            -- Check if there is any holiday record (active or cancelled) for this classroom on NEW.on_behalf_of_date
            SELECT EXISTS (
                SELECT 1 FROM public.classroom_holidays ch
                WHERE (
                    ch.classroom_id = NEW.classroom_id
                    OR (
                        COALESCE(v_is_temp_classroom, false) = true
                        AND EXISTS (
                            SELECT 1 FROM public.classroom_students cs
                            WHERE cs.classroom_id = ch.classroom_id
                              AND cs.student_id = NEW.student_id
                        )
                    )
                )
                  AND ch.holiday_date = NEW.on_behalf_of_date
            ) INTO v_has_any_holiday_on_behalf;

            IF v_has_any_holiday_on_behalf THEN
                SELECT EXISTS (
                    SELECT 1 FROM public.classroom_holidays ch
                    WHERE (
                        ch.classroom_id = NEW.classroom_id
                        OR (
                            COALESCE(v_is_temp_classroom, false) = true
                            AND EXISTS (
                                SELECT 1 FROM public.classroom_students cs
                                WHERE cs.classroom_id = ch.classroom_id
                                  AND cs.student_id = NEW.student_id
                            )
                        )
                    )
                      AND ch.holiday_date = NEW.on_behalf_of_date
                      AND ch.alternative_date = NEW.date
                      AND ch.status = 'active'
                      AND ch.holiday_type IN ('with_alternative', 'alternative_scheduled')
                ) INTO v_has_valid_scheduled_alt;

                IF NOT v_has_valid_scheduled_alt THEN
                    RAISE EXCEPTION 'Cannot record on-behalf-of attendance: no active scheduled alternative exists for date % on behalf of holiday %.', NEW.date, NEW.on_behalf_of_date
                        USING ERRCODE = '23514';
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Update schedule_holiday_alternative fail-closed check to include temporary classrooms
CREATE OR REPLACE FUNCTION public.schedule_holiday_alternative(
    p_holiday_id UUID,
    p_alternative_date DATE,
    p_alt_start_time TIME WITHOUT TIME ZONE,
    p_alt_end_time TIME WITHOUT TIME ZONE,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_holiday public.classroom_holidays%ROWTYPE;
    v_teacher_id UUID;
    v_classroom_name TEXT;
    v_clean_reason TEXT;
    v_prev_alt_date DATE;
    v_action TEXT;
    v_conflict_room TEXT;
    v_student_rec RECORD;
    v_notif_title TEXT;
    v_notif_message TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or administrators can schedule alternative classes.'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_holiday
    FROM public.classroom_holidays
    WHERE id = p_holiday_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Holiday % not found.', p_holiday_id USING ERRCODE = 'P0002';
    END IF;

    IF v_holiday.status <> 'active' THEN
        RAISE EXCEPTION 'Cannot schedule alternative: holiday is %.', v_holiday.status USING ERRCODE = '22023';
    END IF;

    SELECT name, teacher_id INTO v_classroom_name, v_teacher_id
    FROM public.classrooms
    WHERE id = v_holiday.classroom_id;

    IF v_caller_role = 'teacher' THEN
        IF v_teacher_id IS DISTINCT FROM v_caller_id THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only schedule alternatives for their assigned classrooms.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    v_clean_reason := trim(COALESCE(p_reason, ''));
    IF char_length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid scheduling reason (minimum 3 characters) is required.' USING ERRCODE = '22023';
    END IF;

    IF p_alternative_date IS NULL THEN
        RAISE EXCEPTION 'Alternative class date is required.' USING ERRCODE = '22023';
    END IF;

    IF p_alternative_date = v_holiday.holiday_date THEN
        RAISE EXCEPTION 'Alternative class date cannot be the same as the holiday date.' USING ERRCODE = '22023';
    END IF;

    -- Fail-Closed Check on Existing Replacement Attendance (permanent or linked temporary classroom)
    IF v_holiday.alternative_date IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.attendance a
            LEFT JOIN public.classrooms c ON c.id = a.classroom_id
            WHERE (
                a.classroom_id = v_holiday.classroom_id
                OR (
                    c.type = 'temporary'
                    AND EXISTS (
                        SELECT 1 FROM public.classroom_students cs
                        WHERE cs.classroom_id = v_holiday.classroom_id
                          AND cs.student_id = a.student_id
                    )
                )
            )
              AND a.date = v_holiday.alternative_date
              AND a.on_behalf_of_date = v_holiday.holiday_date
              AND a.status IN ('present', 'late', 'absent', 'excused')
        ) THEN
            RAISE EXCEPTION 'Cannot reschedule alternative class: attendance has already been recorded on %. Attendance must be unmarked first using unmark_historical_attendance().', v_holiday.alternative_date
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Check if target alternative date is already a holiday for this classroom
    IF EXISTS (
        SELECT 1 FROM public.classroom_holidays
        WHERE classroom_id = v_holiday.classroom_id
          AND holiday_date = p_alternative_date
          AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Alternative date % is already declared as a holiday for this classroom.', p_alternative_date
            USING ERRCODE = '23514';
    END IF;

    -- Check if target alternative date is already booked as an alternative for another holiday
    IF EXISTS (
        SELECT 1 FROM public.classroom_holidays
        WHERE classroom_id = v_holiday.classroom_id
          AND alternative_date = p_alternative_date
          AND id <> p_holiday_id
          AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Alternative date % is already booked as an alternative for another holiday in this classroom.', p_alternative_date
            USING ERRCODE = '23514';
    END IF;

    -- Teacher conflict checks if times provided
    IF v_teacher_id IS NOT NULL AND p_alt_start_time IS NOT NULL AND p_alt_end_time IS NOT NULL THEN
        SELECT c.name INTO v_conflict_room
        FROM public.batch_schedules bs
        JOIN public.classrooms c ON c.id = bs.classroom_id
        WHERE c.teacher_id = v_teacher_id
          AND c.id <> v_holiday.classroom_id
          AND bs.day_of_week = EXTRACT(DOW FROM p_alternative_date)::INTEGER
          AND (bs.start_time, bs.end_time) OVERLAPS (p_alt_start_time, p_alt_end_time)
        LIMIT 1;

        IF v_conflict_room IS NOT NULL THEN
            RAISE EXCEPTION 'Teacher scheduling conflict: Teacher is already teaching regular class in "%" on that day/time.', v_conflict_room
                USING ERRCODE = '23514';
        END IF;

        SELECT c.name INTO v_conflict_room
        FROM public.classroom_holidays ch
        JOIN public.classrooms c ON c.id = ch.classroom_id
        WHERE c.teacher_id = v_teacher_id
          AND c.id <> v_holiday.classroom_id
          AND ch.status = 'active'
          AND ch.alternative_date = p_alternative_date
          AND ch.alternative_start_time IS NOT NULL
          AND ch.alternative_end_time IS NOT NULL
          AND (ch.alternative_start_time, ch.alternative_end_time) OVERLAPS (p_alt_start_time, p_alt_end_time)
        LIMIT 1;

        IF v_conflict_room IS NOT NULL THEN
            RAISE EXCEPTION 'Teacher scheduling conflict: Teacher is already scheduled for an alternative class in "%" on % at overlapping time.', v_conflict_room, p_alternative_date
                USING ERRCODE = '23514';
        END IF;
    END IF;

    v_prev_alt_date := v_holiday.alternative_date;
    IF v_prev_alt_date IS NULL THEN
        v_action := 'scheduled';
    ELSE
        v_action := 'rescheduled';
    END IF;

    UPDATE public.classroom_holidays
    SET holiday_type = 'alternative_scheduled',
        alternative_date = p_alternative_date,
        alternative_start_time = p_alt_start_time,
        alternative_end_time = p_alt_end_time,
        updated_at = NOW()
    WHERE id = p_holiday_id;

    INSERT INTO public.classroom_holiday_audit_logs (
        holiday_id,
        classroom_id,
        holiday_date,
        action,
        holiday_type,
        alternative_date,
        previous_alternative_date,
        actor_id,
        actor_role,
        reason
    ) VALUES (
        p_holiday_id,
        v_holiday.classroom_id,
        v_holiday.holiday_date,
        v_action,
        'alternative_scheduled',
        p_alternative_date,
        v_prev_alt_date,
        v_caller_id,
        v_caller_role,
        v_clean_reason
    );

    v_notif_title := 'Replacement Class Confirmed: ' || COALESCE(v_classroom_name, 'Classroom');
    v_notif_message := 'The replacement class for holiday on ' || v_holiday.holiday_date::TEXT ||
                       ' is confirmed for ' || p_alternative_date::TEXT ||
                       CASE WHEN p_alt_start_time IS NOT NULL THEN ' at ' || p_alt_start_time::TEXT ELSE '' END ||
                       '. (Reason: ' || v_clean_reason || ')';

    FOR v_student_rec IN
        SELECT cs.student_id
        FROM public.classroom_students cs
        JOIN public.users u ON u.id = cs.student_id
        WHERE cs.classroom_id = v_holiday.classroom_id
          AND LOWER(COALESCE(u.status, 'active')) = 'active'
    LOOP
        PERFORM public.send_idempotent_notification(
            v_student_rec.student_id,
            'holiday_alternative_scheduled',
            p_holiday_id::TEXT,
            p_alternative_date::TEXT,
            v_notif_title,
            v_notif_message,
            'classroom',
            jsonb_build_object(
                'holiday_id', p_holiday_id,
                'holiday_date', v_holiday.holiday_date,
                'alternative_date', p_alternative_date,
                'previous_alternative_date', v_prev_alt_date,
                'action', v_action
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'holiday_id', p_holiday_id,
        'action', v_action,
        'holiday_date', v_holiday.holiday_date,
        'previous_alternative_date', v_prev_alt_date,
        'alternative_date', p_alternative_date,
        'alternative_start_time', p_alt_start_time,
        'alternative_end_time', p_alt_end_time
    );
END;
$$;

-- 4. Update revert_holiday_alternative_to_pending fail-closed check
CREATE OR REPLACE FUNCTION public.revert_holiday_alternative_to_pending(
    p_holiday_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_holiday public.classroom_holidays%ROWTYPE;
    v_teacher_id UUID;
    v_classroom_name TEXT;
    v_clean_reason TEXT;
    v_prev_alt_date DATE;
    v_student_rec RECORD;
    v_notif_title TEXT;
    v_notif_message TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or administrators can revert alternative classes.'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_holiday
    FROM public.classroom_holidays
    WHERE id = p_holiday_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Holiday % not found.', p_holiday_id USING ERRCODE = 'P0002';
    END IF;

    IF v_holiday.status <> 'active' THEN
        RAISE EXCEPTION 'Cannot revert alternative: holiday is %.', v_holiday.status USING ERRCODE = '22023';
    END IF;

    SELECT name, teacher_id INTO v_classroom_name, v_teacher_id
    FROM public.classrooms
    WHERE id = v_holiday.classroom_id;

    IF v_caller_role = 'teacher' THEN
        IF v_teacher_id IS DISTINCT FROM v_caller_id THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only manage alternatives for their assigned classrooms.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    v_clean_reason := trim(COALESCE(p_reason, ''));
    IF char_length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid reason (minimum 3 characters) is required to revert alternative to pending.'
            USING ERRCODE = '22023';
    END IF;

    IF v_holiday.alternative_date IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.attendance a
            LEFT JOIN public.classrooms c ON c.id = a.classroom_id
            WHERE (
                a.classroom_id = v_holiday.classroom_id
                OR (
                    c.type = 'temporary'
                    AND EXISTS (
                        SELECT 1 FROM public.classroom_students cs
                        WHERE cs.classroom_id = v_holiday.classroom_id
                          AND cs.student_id = a.student_id
                    )
                )
            )
              AND a.date = v_holiday.alternative_date
              AND a.on_behalf_of_date = v_holiday.holiday_date
              AND a.status IN ('present', 'late', 'absent', 'excused')
        ) THEN
            RAISE EXCEPTION 'Cannot revert alternative class to pending: attendance has already been recorded on %. Attendance must be unmarked first using unmark_historical_attendance().', v_holiday.alternative_date
                USING ERRCODE = '23514';
        END IF;
    END IF;

    v_prev_alt_date := v_holiday.alternative_date;

    UPDATE public.classroom_holidays
    SET holiday_type = 'alternative_pending',
        alternative_date = NULL,
        alternative_start_time = NULL,
        alternative_end_time = NULL,
        updated_at = NOW()
    WHERE id = p_holiday_id;

    INSERT INTO public.classroom_holiday_audit_logs (
        holiday_id,
        classroom_id,
        holiday_date,
        action,
        holiday_type,
        alternative_date,
        previous_alternative_date,
        actor_id,
        actor_role,
        reason
    ) VALUES (
        p_holiday_id,
        v_holiday.classroom_id,
        v_holiday.holiday_date,
        'reverted_to_pending',
        'alternative_pending',
        NULL,
        v_prev_alt_date,
        v_caller_id,
        v_caller_role,
        v_clean_reason
    );

    v_notif_title := 'Replacement Class Postponed: ' || COALESCE(v_classroom_name, 'Classroom');
    v_notif_message := 'The scheduled replacement class on ' || v_prev_alt_date::TEXT ||
                       ' for holiday on ' || v_holiday.holiday_date::TEXT ||
                       ' has been postponed (Reason: ' || v_clean_reason || '). A new replacement date will be announced.';

    FOR v_student_rec IN
        SELECT cs.student_id
        FROM public.classroom_students cs
        JOIN public.users u ON u.id = cs.student_id
        WHERE cs.classroom_id = v_holiday.classroom_id
          AND LOWER(COALESCE(u.status, 'active')) = 'active'
    LOOP
        PERFORM public.send_idempotent_notification(
            v_student_rec.student_id,
            'holiday_alternative_postponed',
            p_holiday_id::TEXT,
            v_holiday.holiday_date::TEXT,
            v_notif_title,
            v_notif_message,
            'classroom',
            jsonb_build_object(
                'holiday_id', p_holiday_id,
                'holiday_date', v_holiday.holiday_date,
                'previous_alternative_date', v_prev_alt_date,
                'reason', v_clean_reason
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'holiday_id', p_holiday_id,
        'action', 'reverted_to_pending',
        'holiday_date', v_holiday.holiday_date,
        'previous_alternative_date', v_prev_alt_date
    );
END;
$$;

-- 5. Update cancel_classroom_holiday fail-closed check
CREATE OR REPLACE FUNCTION public.cancel_classroom_holiday(
    p_holiday_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_holiday public.classroom_holidays%ROWTYPE;
    v_classroom_name TEXT;
    v_clean_reason TEXT;
    v_student_rec RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or administrators can cancel holidays.'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_holiday
    FROM public.classroom_holidays
    WHERE id = p_holiday_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Holiday % not found.', p_holiday_id USING ERRCODE = 'P0002';
    END IF;

    IF v_holiday.status <> 'active' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Holiday is already cancelled',
            'holiday_id', p_holiday_id
        );
    END IF;

    SELECT name INTO v_classroom_name FROM public.classrooms WHERE id = v_holiday.classroom_id;

    IF v_caller_role = 'teacher' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.classrooms
            WHERE id = v_holiday.classroom_id AND teacher_id = v_caller_id
        ) THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only cancel holidays for their assigned classrooms.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    v_clean_reason := trim(COALESCE(p_reason, ''));
    IF char_length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid cancellation reason (minimum 3 characters) is required.'
            USING ERRCODE = '22023';
    END IF;

    IF v_holiday.holiday_type IN ('with_alternative', 'alternative_scheduled') AND v_holiday.alternative_date IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.attendance a
            LEFT JOIN public.classrooms c ON c.id = a.classroom_id
            WHERE (
                a.classroom_id = v_holiday.classroom_id
                OR (
                    c.type = 'temporary'
                    AND EXISTS (
                        SELECT 1 FROM public.classroom_students cs
                        WHERE cs.classroom_id = v_holiday.classroom_id
                          AND cs.student_id = a.student_id
                    )
                )
            )
              AND a.date = v_holiday.alternative_date
              AND a.on_behalf_of_date = v_holiday.holiday_date
              AND a.status IN ('present', 'late', 'absent', 'excused')
        ) THEN
            RAISE EXCEPTION 'Cannot cancel holiday: attendance has already been recorded for the alternative class on %. Alternative class attendance must be corrected or unmarked first.', v_holiday.alternative_date
                USING ERRCODE = '23514';
        END IF;
    END IF;

    UPDATE public.classroom_holidays
    SET status = 'cancelled',
        cancelled_by = v_caller_id,
        cancelled_at = NOW(),
        cancellation_reason = v_clean_reason,
        updated_at = NOW()
    WHERE id = p_holiday_id;

    INSERT INTO public.classroom_holiday_audit_logs (
        holiday_id,
        classroom_id,
        holiday_date,
        action,
        holiday_type,
        alternative_date,
        actor_id,
        actor_role,
        reason
    ) VALUES (
        p_holiday_id,
        v_holiday.classroom_id,
        v_holiday.holiday_date,
        'cancelled',
        v_holiday.holiday_type,
        v_holiday.alternative_date,
        v_caller_id,
        v_caller_role,
        v_clean_reason
    );

    FOR v_student_rec IN
        SELECT cs.student_id
        FROM public.classroom_students cs
        JOIN public.users u ON u.id = cs.student_id
        WHERE cs.classroom_id = v_holiday.classroom_id
          AND LOWER(COALESCE(u.status, 'active')) = 'active'
    LOOP
        PERFORM public.send_idempotent_notification(
            v_student_rec.student_id,
            'holiday_cancelled',
            p_holiday_id::TEXT,
            v_holiday.holiday_date::TEXT,
            'Holiday Cancelled: ' || COALESCE(v_classroom_name, 'Classroom'),
            'Holiday for ' || v_holiday.holiday_date::TEXT || ' has been cancelled. Regular class schedule is restored.',
            'classroom',
            jsonb_build_object(
                'holiday_id', p_holiday_id,
                'holiday_date', v_holiday.holiday_date,
                'reason', v_clean_reason
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'holiday_id', p_holiday_id,
        'message', 'Holiday successfully cancelled.'
    );
END;
$$;

COMMIT;
