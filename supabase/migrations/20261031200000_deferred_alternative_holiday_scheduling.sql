-- =====================================================================================
-- Migration: 20261031200000_deferred_alternative_holiday_scheduling.sql
-- Description: KFA Bulk Holiday Management & Deferred Alternative Scheduling
--              1. Support 3 holiday states: NO_ALTERNATIVE, ALTERNATIVE_PENDING, ALTERNATIVE_SCHEDULED
--              2. Full backward compatibility with existing with_alternative records
--              3. Bulk and selected classroom holiday declaration RPC
--              4. Deferred alternative scheduling and rescheduling with conflict checks
--              5. Revert alternative to pending RPC
--              6. Strict fail-closed attendance protections on cancellations/reschedules
--              7. Preserved financial invariants, zero-deduction holiday, single-deduction replacement
-- =====================================================================================

-- 1. Table Schema Updates: public.classroom_holidays
ALTER TABLE public.classroom_holidays
    DROP CONSTRAINT IF EXISTS chk_classroom_holidays_alt_type,
    DROP CONSTRAINT IF EXISTS chk_classroom_holidays_type,
    DROP CONSTRAINT IF EXISTS classroom_holidays_holiday_type_check,
    DROP CONSTRAINT IF EXISTS chk_classroom_holidays_state_consistency;

-- Allow legacy 'with_alternative' alongside the 3 canonical states
ALTER TABLE public.classroom_holidays
    ADD CONSTRAINT chk_classroom_holidays_type CHECK (
        holiday_type IN ('no_alternative', 'alternative_pending', 'alternative_scheduled', 'with_alternative')
    );

-- Add bulk_group_id to link multi-classroom bulk operations
ALTER TABLE public.classroom_holidays
    ADD COLUMN IF NOT EXISTS bulk_group_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_classroom_holidays_bulk_group
    ON public.classroom_holidays(bulk_group_id)
    WHERE bulk_group_id IS NOT NULL;

-- Strict state consistency constraint
ALTER TABLE public.classroom_holidays
    ADD CONSTRAINT chk_classroom_holidays_state_consistency CHECK (
        (holiday_type = 'no_alternative' AND alternative_date IS NULL) OR
        (holiday_type = 'alternative_pending' AND alternative_date IS NULL) OR
        (holiday_type IN ('alternative_scheduled', 'with_alternative') 
            AND alternative_date IS NOT NULL 
            AND alternative_date <> holiday_date)
    );

-- 2. Table Schema Updates: public.classroom_holiday_audit_logs
ALTER TABLE public.classroom_holiday_audit_logs
    DROP CONSTRAINT IF EXISTS classroom_holiday_audit_logs_action_check,
    DROP CONSTRAINT IF EXISTS chk_holiday_audit_action;

ALTER TABLE public.classroom_holiday_audit_logs
    ADD CONSTRAINT chk_holiday_audit_action CHECK (
        action IN ('declared', 'scheduled', 'rescheduled', 'reverted_to_pending', 'cancelled')
    );

ALTER TABLE public.classroom_holiday_audit_logs
    ADD COLUMN IF NOT EXISTS previous_alternative_date DATE NULL;

-- 3. Attendance Prevention Trigger Update
CREATE OR REPLACE FUNCTION public.prevent_attendance_on_holiday()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.date IS DISTINCT FROM NEW.date) THEN
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

        -- If attempting to mark on an alternative date where holiday is not active or still pending, block
        IF NEW.on_behalf_of_date IS NOT NULL AND NEW.on_behalf_of_date <> NEW.date THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.classroom_holidays
                WHERE classroom_id = NEW.classroom_id
                  AND holiday_date = NEW.on_behalf_of_date
                  AND alternative_date = NEW.date
                  AND status = 'active'
                  AND holiday_type IN ('with_alternative', 'alternative_scheduled')
            ) THEN
                RAISE EXCEPTION 'Cannot record on-behalf-of attendance: no active scheduled alternative exists for date % on behalf of holiday %.', NEW.date, NEW.on_behalf_of_date
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Authoritative Transactional RPC: declare_classroom_holiday
DROP FUNCTION IF EXISTS public.declare_classroom_holiday(UUID, DATE, TEXT, TEXT, DATE, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE);
CREATE OR REPLACE FUNCTION public.declare_classroom_holiday(
    p_classroom_id UUID,
    p_holiday_date DATE,
    p_holiday_type TEXT,
    p_reason TEXT,
    p_alternative_date DATE DEFAULT NULL,
    p_alt_start_time TIME DEFAULT NULL,
    p_alt_end_time TIME DEFAULT NULL,
    p_bulk_group_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_teacher_id UUID;
    v_is_assigned_teacher BOOLEAN := false;
    v_holiday_id UUID;
    v_classroom_name TEXT;
    v_clean_type TEXT;
    v_clean_reason TEXT;
    v_existing RECORD;
    v_student_rec RECORD;
    v_notif_title TEXT;
    v_notif_message TEXT;
    v_conflict_room TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or administrators can declare holidays.'
            USING ERRCODE = '42501';
    END IF;

    SELECT name, teacher_id INTO v_classroom_name, v_teacher_id 
    FROM public.classrooms 
    WHERE id = p_classroom_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Classroom % not found.', p_classroom_id USING ERRCODE = 'P0002';
    END IF;

    IF v_caller_role = 'teacher' THEN
        IF v_teacher_id IS DISTINCT FROM v_caller_id THEN
            RAISE EXCEPTION 'Unauthorized: teachers can only declare holidays for their assigned classrooms.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    v_clean_type := LOWER(TRIM(COALESCE(p_holiday_type, '')));
    IF v_clean_type NOT IN ('no_alternative', 'alternative_pending', 'alternative_scheduled', 'with_alternative') THEN
        RAISE EXCEPTION 'Invalid holiday_type: %. Must be no_alternative, alternative_pending, or alternative_scheduled.', p_holiday_type
            USING ERRCODE = '22023';
    END IF;

    -- Normalize legacy with_alternative to canonical alternative_scheduled
    IF v_clean_type = 'with_alternative' THEN
        v_clean_type := 'alternative_scheduled';
    END IF;

    v_clean_reason := trim(COALESCE(p_reason, ''));
    IF char_length(v_clean_reason) < 3 THEN
        RAISE EXCEPTION 'A valid holiday reason (minimum 3 characters) is required.'
            USING ERRCODE = '22023';
    END IF;

    -- Validate alternative date logic
    IF v_clean_type = 'alternative_scheduled' THEN
        IF p_alternative_date IS NULL THEN
            RAISE EXCEPTION 'Alternative class date is required when holiday type is alternative_scheduled.'
                USING ERRCODE = '22023';
        END IF;
        IF p_alternative_date = p_holiday_date THEN
            RAISE EXCEPTION 'Alternative class date cannot be the same as the holiday date.'
                USING ERRCODE = '22023';
        END IF;
    ELSE
        p_alternative_date := NULL;
        p_alt_start_time := NULL;
        p_alt_end_time := NULL;
    END IF;

    -- Check for existing active holiday on holiday_date (Idempotency)
    SELECT * INTO v_existing
    FROM public.classroom_holidays
    WHERE classroom_id = p_classroom_id
      AND holiday_date = p_holiday_date
      AND status = 'active'
    FOR UPDATE;

    IF v_existing.id IS NOT NULL THEN
        IF v_existing.holiday_type = v_clean_type AND
           v_existing.alternative_date IS NOT DISTINCT FROM p_alternative_date THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'message', 'Holiday is already declared with identical parameters (idempotent).',
                'holiday_id', v_existing.id,
                'classroom_id', p_classroom_id,
                'holiday_date', p_holiday_date,
                'holiday_type', v_existing.holiday_type,
                'alternative_date', v_existing.alternative_date,
                'bulk_group_id', v_existing.bulk_group_id
            );
        ELSE
            RAISE EXCEPTION 'A holiday is already declared for classroom on date % with different parameters.', p_holiday_date
                USING ERRCODE = '23505';
        END IF;
    END IF;

    -- Validate Alternative Date Conflicts
    IF p_alternative_date IS NOT NULL THEN
        -- Check if alternative date is a holiday in this classroom
        IF EXISTS (
            SELECT 1 FROM public.classroom_holidays
            WHERE classroom_id = p_classroom_id
              AND holiday_date = p_alternative_date
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Alternative date % is already declared as a holiday for this classroom.', p_alternative_date
                USING ERRCODE = '23514';
        END IF;

        -- Check if alternative date is already booked as alternative in this classroom
        IF EXISTS (
            SELECT 1 FROM public.classroom_holidays
            WHERE classroom_id = p_classroom_id
              AND alternative_date = p_alternative_date
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Alternative date % is already booked as an alternative for another holiday in this classroom.', p_alternative_date
                USING ERRCODE = '23514';
        END IF;

        -- Teacher double-booking conflict check if times provided
        IF v_teacher_id IS NOT NULL AND p_alt_start_time IS NOT NULL AND p_alt_end_time IS NOT NULL THEN
            -- Check overlapping regular batch schedule in other classrooms
            SELECT c.name INTO v_conflict_room
            FROM public.batch_schedules bs
            JOIN public.classrooms c ON c.id = bs.classroom_id
            WHERE c.teacher_id = v_teacher_id
              AND c.id <> p_classroom_id
              AND bs.day_of_week = EXTRACT(DOW FROM p_alternative_date)::INTEGER
              AND (bs.start_time, bs.end_time) OVERLAPS (p_alt_start_time, p_alt_end_time)
            LIMIT 1;

            IF v_conflict_room IS NOT NULL THEN
                RAISE EXCEPTION 'Teacher scheduling conflict: Teacher is already teaching regular class in "%" on that day/time.', v_conflict_room
                    USING ERRCODE = '23514';
            END IF;

            -- Check overlapping alternative class in other classrooms
            SELECT c.name INTO v_conflict_room
            FROM public.classroom_holidays ch
            JOIN public.classrooms c ON c.id = ch.classroom_id
            WHERE c.teacher_id = v_teacher_id
              AND c.id <> p_classroom_id
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
    END IF;

    -- Fail-closed: block holiday declaration if attendance is already recorded on holiday_date
    IF EXISTS (
        SELECT 1 FROM public.attendance
        WHERE classroom_id = p_classroom_id
          AND date = p_holiday_date
          AND status IN ('present', 'late', 'absent', 'excused')
    ) THEN
        RAISE EXCEPTION 'Cannot declare holiday: attendance is already recorded for classroom on date %. Historical attendance must be corrected or unmarked first.', p_holiday_date
            USING ERRCODE = '23514';
    END IF;

    -- Mandatory Correction 1: Pending leave requests must be cancelled with explicit cancellation reason
    UPDATE public.leave_requests
    SET status = 'cancelled',
        cancellation_reason = 'Cancelled due to declared classroom holiday',
        updated_at = NOW()
    WHERE classroom_id = p_classroom_id
      AND class_date = p_holiday_date
      AND status = 'pending';

    -- Insert Holiday Record
    INSERT INTO public.classroom_holidays (
        classroom_id,
        holiday_date,
        holiday_type,
        reason,
        alternative_date,
        alternative_start_time,
        alternative_end_time,
        status,
        declared_by,
        declared_at,
        bulk_group_id
    ) VALUES (
        p_classroom_id,
        p_holiday_date,
        v_clean_type,
        v_clean_reason,
        p_alternative_date,
        p_alt_start_time,
        p_alt_end_time,
        'active',
        v_caller_id,
        NOW(),
        p_bulk_group_id
    )
    RETURNING id INTO v_holiday_id;

    -- Immutable Audit Log
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
        v_holiday_id,
        p_classroom_id,
        p_holiday_date,
        'declared',
        v_clean_type,
        p_alternative_date,
        v_caller_id,
        v_caller_role,
        v_clean_reason
    );

    -- Dispatch Notifications to Active Enrolled Students
    v_notif_title := 'Class Holiday Declared: ' || COALESCE(v_classroom_name, 'Classroom');
    IF v_clean_type = 'alternative_scheduled' THEN
        v_notif_message := 'Class on ' || p_holiday_date::TEXT || ' is cancelled: ' || v_clean_reason ||
                           '. An alternative replacement class is scheduled on ' || p_alternative_date::TEXT ||
                           ' (On Behalf Of ' || p_holiday_date::TEXT || ').';
    ELSIF v_clean_type = 'alternative_pending' THEN
        v_notif_message := 'Class on ' || p_holiday_date::TEXT || ' is cancelled: ' || v_clean_reason ||
                           '. A replacement class will be conducted; date and time will be announced soon.';
    ELSE
        v_notif_message := 'Class on ' || p_holiday_date::TEXT || ' is cancelled: ' || v_clean_reason ||
                           '. No alternative replacement class is scheduled. No credits will be deducted.';
    END IF;

    FOR v_student_rec IN
        SELECT cs.student_id
        FROM public.classroom_students cs
        JOIN public.users u ON u.id = cs.student_id
        WHERE cs.classroom_id = p_classroom_id
          AND LOWER(COALESCE(u.status, 'active')) = 'active'
    LOOP
        PERFORM public.send_idempotent_notification(
            v_student_rec.student_id,
            'holiday_declared',
            v_holiday_id::TEXT,
            p_holiday_date::TEXT,
            v_notif_title,
            v_notif_message,
            'classroom',
            jsonb_build_object(
                'holiday_id', v_holiday_id,
                'holiday_date', p_holiday_date,
                'holiday_type', v_clean_type,
                'alternative_date', p_alternative_date,
                'classroom_id', p_classroom_id
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'holiday_id', v_holiday_id,
        'classroom_id', p_classroom_id,
        'holiday_date', p_holiday_date,
        'holiday_type', v_clean_type,
        'alternative_date', p_alternative_date,
        'bulk_group_id', p_bulk_group_id
    );
END;
$$;

-- 5. Bulk Holiday Declaration RPC: declare_bulk_classroom_holidays
CREATE OR REPLACE FUNCTION public.declare_bulk_classroom_holidays(
    p_classroom_ids UUID[],
    p_holiday_date DATE,
    p_holiday_type TEXT,
    p_reason TEXT,
    p_default_alt_date DATE DEFAULT NULL,
    p_default_alt_start TIME DEFAULT NULL,
    p_default_alt_end TIME DEFAULT NULL,
    p_scope TEXT DEFAULT 'selected'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_target_room_ids UUID[] := '{}';
    v_target_room_id UUID;
    v_bulk_group_id UUID := gen_random_uuid();
    v_declared_count INTEGER := 0;
    v_dow INTEGER := EXTRACT(DOW FROM p_holiday_date)::INTEGER;
    v_res JSONB;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: only teachers or administrators can declare bulk holidays.'
            USING ERRCODE = '42501';
    END IF;

    -- Resolve classrooms based on scope
    IF p_scope = 'all_scheduled' THEN
        -- Find all classrooms that have a batch schedule running on this day of week
        IF v_caller_role = 'admin' THEN
            SELECT ARRAY_AGG(DISTINCT c.id) INTO v_target_room_ids
            FROM public.classrooms c
            JOIN public.batch_schedules bs ON bs.classroom_id = c.id
            WHERE bs.day_of_week = v_dow
              AND c.status = 'active';
        ELSE
            SELECT ARRAY_AGG(DISTINCT c.id) INTO v_target_room_ids
            FROM public.classrooms c
            JOIN public.batch_schedules bs ON bs.classroom_id = c.id
            WHERE bs.day_of_week = v_dow
              AND c.status = 'active'
              AND c.teacher_id = v_caller_id;
        END IF;
    ELSE
        -- Selected scope: use p_classroom_ids
        IF p_classroom_ids IS NULL OR cardinality(p_classroom_ids) = 0 THEN
            RAISE EXCEPTION 'No classrooms specified for selected bulk holiday declaration.' USING ERRCODE = '22023';
        END IF;

        -- Server-side eligibility and authorization verification for each classroom (Mandatory Correction 5)
        IF v_caller_role = 'teacher' THEN
            IF EXISTS (
                SELECT 1 FROM UNNEST(p_classroom_ids) cid
                JOIN public.classrooms c ON c.id = cid
                WHERE c.teacher_id IS DISTINCT FROM v_caller_id
            ) THEN
                RAISE EXCEPTION 'Unauthorized: teachers can only declare holidays for their assigned classrooms.' USING ERRCODE = '42501';
            END IF;
        END IF;

        v_target_room_ids := p_classroom_ids;
    END IF;

    IF v_target_room_ids IS NULL OR cardinality(v_target_room_ids) = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'No eligible scheduled classrooms found for date.',
            'affected_count', 0,
            'bulk_group_id', v_bulk_group_id
        );
    END IF;

    -- Atomically declare holiday for each classroom with the shared bulk_group_id
    FOREACH v_target_room_id IN ARRAY v_target_room_ids
    LOOP
        v_res := public.declare_classroom_holiday(
            v_target_room_id,
            p_holiday_date,
            p_holiday_type,
            p_reason,
            p_default_alt_date,
            p_default_alt_start,
            p_default_alt_end,
            v_bulk_group_id
        );
        v_declared_count := v_declared_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'bulk_group_id', v_bulk_group_id,
        'affected_count', v_declared_count,
        'holiday_date', p_holiday_date,
        'holiday_type', p_holiday_type,
        'classroom_ids', v_target_room_ids
    );
END;
$$;

-- 6. Deferred Alternative Class Scheduling RPC: schedule_holiday_alternative
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

    -- Mandatory Correction 3: Fail-Closed Check on Existing Replacement Attendance
    -- If attendance was ALREADY recorded on the previous alternative date, block rescheduling!
    IF v_holiday.alternative_date IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.attendance
            WHERE classroom_id = v_holiday.classroom_id
              AND date = v_holiday.alternative_date
              AND on_behalf_of_date = v_holiday.holiday_date
              AND status IN ('present', 'late', 'absent', 'excused')
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

    -- Update Holiday Record
    UPDATE public.classroom_holidays
    SET holiday_type = 'alternative_scheduled',
        alternative_date = p_alternative_date,
        alternative_start_time = p_alt_start_time,
        alternative_end_time = p_alt_end_time,
        updated_at = NOW()
    WHERE id = p_holiday_id;

    -- Immutable Audit Log
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

    -- Notify Enrolled Active Students
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

-- 7. Revert Alternative to Pending RPC: revert_holiday_alternative_to_pending
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

    -- Mandatory Correction 3: Fail-Closed Check on Existing Replacement Attendance
    IF v_holiday.alternative_date IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.attendance
            WHERE classroom_id = v_holiday.classroom_id
              AND date = v_holiday.alternative_date
              AND on_behalf_of_date = v_holiday.holiday_date
              AND status IN ('present', 'late', 'absent', 'excused')
        ) THEN
            RAISE EXCEPTION 'Cannot revert alternative class to pending: attendance has already been recorded on %. Attendance must be unmarked first using unmark_historical_attendance().', v_holiday.alternative_date
                USING ERRCODE = '23514';
        END IF;
    END IF;

    v_prev_alt_date := v_holiday.alternative_date;

    -- Update Holiday Record to alternative_pending
    UPDATE public.classroom_holidays
    SET holiday_type = 'alternative_pending',
        alternative_date = NULL,
        alternative_start_time = NULL,
        alternative_end_time = NULL,
        updated_at = NOW()
    WHERE id = p_holiday_id;

    -- Immutable Audit Log
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

    -- Notify Enrolled Active Students
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

-- 8. Cancel Holiday RPC with Fail-Closed Attendance Lock: cancel_classroom_holiday
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

    -- Mandatory Correction 3: Fail-Closed Check on Existing Replacement Attendance
    IF v_holiday.holiday_type IN ('with_alternative', 'alternative_scheduled') AND v_holiday.alternative_date IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.attendance
            WHERE classroom_id = v_holiday.classroom_id
              AND date = v_holiday.alternative_date
              AND on_behalf_of_date = v_holiday.holiday_date
              AND status IN ('present', 'late', 'absent', 'excused')
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

-- 9. Grants and Security
GRANT EXECUTE ON FUNCTION public.declare_classroom_holiday(UUID, DATE, TEXT, TEXT, DATE, TIME, TIME, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.declare_bulk_classroom_holidays(UUID[], DATE, TEXT, TEXT, DATE, TIME, TIME, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.schedule_holiday_alternative(UUID, DATE, TIME, TIME, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revert_holiday_alternative_to_pending(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_classroom_holiday(UUID, TEXT) TO authenticated, service_role;
