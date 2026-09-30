-- ==============================================================================
-- Migration: Repair Historical Attendance Corruption & Permanently Disable Trigger
-- Date: 2026-09-30
-- Description:
-- 1. Updates transfer_student_history_on_class_shift() to PERMANENTLY REMOVE
--    the destructive 'UPDATE public.attendance' clause on student classroom transfer.
-- 2. Restores exactly 22 deterministically proven historical attendance rows
--    with strict guards on id, student_id, date, and current corrupted classroom_id.
-- 3. Ambiguous rows (Akshaghna S Aug 07/14, anurag rai Sep 04, Pranshu Aug 07)
--    are strictly left untouched.
-- ==============================================================================

-- STEP 1: PERMANENTLY REMOVE ATTENDANCE MUTATION FROM CLASSROOM TRANSFER TRIGGER
CREATE OR REPLACE FUNCTION public.transfer_student_history_on_class_shift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec RECORD;
    v_target_topic_id UUID;
BEGIN
    IF NEW.classroom_id IS NULL OR NEW.student_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- NOTE: DO NOT MODIFY public.attendance!
    -- Historical attendance is immutable with respect to future classroom transfers.
    -- The previous statement:
    --   UPDATE public.attendance att SET classroom_id = NEW.classroom_id ...
    -- has been permanently removed.

    -- 1. Transfer student curriculum topic progress to the new classroom
    UPDATE public.student_topic_progress
    SET classroom_id = NEW.classroom_id
    WHERE student_id = NEW.student_id
      AND classroom_id IS DISTINCT FROM NEW.classroom_id;

    -- 2. Remap assignment submissions where matching titles exist in the target classroom
    FOR rec IN
        SELECT asg_stud.id AS submission_id,
               src_asg.title AS assignment_title,
               target_asg.id AS target_assignment_id
        FROM public.assignment_students asg_stud
        JOIN public.assignments src_asg ON asg_stud.assignment_id = src_asg.id
        JOIN public.assignments target_asg
          ON target_asg.classroom_id = NEW.classroom_id
         AND LOWER(TRIM(target_asg.title)) = LOWER(TRIM(src_asg.title))
        WHERE asg_stud.student_id = NEW.student_id
          AND src_asg.classroom_id IS DISTINCT FROM NEW.classroom_id
    LOOP
        UPDATE public.assignment_students
        SET assignment_id = rec.target_assignment_id
        WHERE id = rec.submission_id;
    END LOOP;

    -- 3. Transfer student-specific curriculum inventory allocations to the new classroom
    UPDATE public.classroom_inventory_allocation
    SET classroom_id = NEW.classroom_id
    WHERE allocated_to_student_id = NEW.student_id
      AND classroom_id IS DISTINCT FROM NEW.classroom_id;

    RETURN NEW;
END;
$$;


-- STEP 2: REPAIR THE 22 DETERMINISTICALLY RECOVERABLE ATTENDANCE ROWS
-- Guarded by: id, student_id, date, and expected corrupted classroom_id.

-- ------------------------------------------------------------------------------
-- 1. Selva Kumar (ddfca297-8cd1-468d-a546-0e64cad35af7)
-- Restoring 8 Saturday rows from Tuesday Slot 3 -> Saturday Slot 4 (Offline - 11 AM)
-- Target: d56c216a-3518-4361-b323-e6845a298e8c
-- ------------------------------------------------------------------------------
UPDATE public.attendance
SET classroom_id = 'd56c216a-3518-4361-b323-e6845a298e8c'
WHERE id = 'acbdc748-2fde-473b-9a44-ab9dd7827972'
  AND student_id = 'ddfca297-8cd1-468d-a546-0e64cad35af7'
  AND date = '2026-08-01'
  AND classroom_id = '3b9316e5-be0c-49a1-a429-b8dda8383104';

UPDATE public.attendance
SET classroom_id = 'd56c216a-3518-4361-b323-e6845a298e8c'
WHERE id = '7a97abab-e8c0-41f8-8c4e-e7c7fb426619'
  AND student_id = 'ddfca297-8cd1-468d-a546-0e64cad35af7'
  AND date = '2026-08-08'
  AND classroom_id = '3b9316e5-be0c-49a1-a429-b8dda8383104';

UPDATE public.attendance
SET classroom_id = 'd56c216a-3518-4361-b323-e6845a298e8c'
WHERE id = '128922ae-961e-4399-8d30-fe8ec8420af8'
  AND student_id = 'ddfca297-8cd1-468d-a546-0e64cad35af7'
  AND date = '2026-08-15'
  AND classroom_id = '3b9316e5-be0c-49a1-a429-b8dda8383104';

UPDATE public.attendance
SET classroom_id = 'd56c216a-3518-4361-b323-e6845a298e8c'
WHERE id = 'db4bd1bc-5f50-48b4-84a7-5e3a4cf01d7b'
  AND student_id = 'ddfca297-8cd1-468d-a546-0e64cad35af7'
  AND date = '2026-08-22'
  AND classroom_id = '3b9316e5-be0c-49a1-a429-b8dda8383104';

UPDATE public.attendance
SET classroom_id = 'd56c216a-3518-4361-b323-e6845a298e8c'
WHERE id = '5eb23738-6046-417a-aeb7-cc6054a5b2d7'
  AND student_id = 'ddfca297-8cd1-468d-a546-0e64cad35af7'
  AND date = '2026-08-29'
  AND classroom_id = '3b9316e5-be0c-49a1-a429-b8dda8383104';

UPDATE public.attendance
SET classroom_id = 'd56c216a-3518-4361-b323-e6845a298e8c'
WHERE id = '56ac7bdb-e0b2-43e9-b88c-5ec594e118f0'
  AND student_id = 'ddfca297-8cd1-468d-a546-0e64cad35af7'
  AND date = '2026-09-05'
  AND classroom_id = '3b9316e5-be0c-49a1-a429-b8dda8383104';

UPDATE public.attendance
SET classroom_id = 'd56c216a-3518-4361-b323-e6845a298e8c'
WHERE id = '6a927de2-2988-4f77-a62b-12ddf12221dc'
  AND student_id = 'ddfca297-8cd1-468d-a546-0e64cad35af7'
  AND date = '2026-09-19'
  AND classroom_id = '3b9316e5-be0c-49a1-a429-b8dda8383104';

UPDATE public.attendance
SET classroom_id = 'd56c216a-3518-4361-b323-e6845a298e8c'
WHERE id = 'b84bcc57-1087-4a47-ab81-6a21f732d73d'
  AND student_id = 'ddfca297-8cd1-468d-a546-0e64cad35af7'
  AND date = '2026-09-26'
  AND classroom_id = '3b9316e5-be0c-49a1-a429-b8dda8383104';

-- ------------------------------------------------------------------------------
-- 2. Trisha Das (9893770a-6806-4a80-ba5d-de6f43e994b3)
-- Restoring 4 Tuesday rows from KFA Learning Circle -> Tuesday Slot 3 (Online - 7:30 PM)
-- Target: 3b9316e5-be0c-49a1-a429-b8dda8383104
-- ------------------------------------------------------------------------------
UPDATE public.attendance
SET classroom_id = '3b9316e5-be0c-49a1-a429-b8dda8383104'
WHERE id = 'f0319ed0-2765-4f20-9051-e65aaac84c5b'
  AND student_id = '9893770a-6806-4a80-ba5d-de6f43e994b3'
  AND date = '2026-08-04'
  AND classroom_id = '9223f9ba-bc0d-4ab9-9635-423951441b62';

UPDATE public.attendance
SET classroom_id = '3b9316e5-be0c-49a1-a429-b8dda8383104'
WHERE id = '1151ef6d-0db9-4126-a5fa-d85dd215c268'
  AND student_id = '9893770a-6806-4a80-ba5d-de6f43e994b3'
  AND date = '2026-08-11'
  AND classroom_id = '9223f9ba-bc0d-4ab9-9635-423951441b62';

UPDATE public.attendance
SET classroom_id = '3b9316e5-be0c-49a1-a429-b8dda8383104'
WHERE id = 'c3445cea-3b49-4327-a96f-6110643146ab'
  AND student_id = '9893770a-6806-4a80-ba5d-de6f43e994b3'
  AND date = '2026-08-18'
  AND classroom_id = '9223f9ba-bc0d-4ab9-9635-423951441b62';

UPDATE public.attendance
SET classroom_id = '3b9316e5-be0c-49a1-a429-b8dda8383104'
WHERE id = '69a31f8c-9945-43f7-bee4-7ce83ed2fdce'
  AND student_id = '9893770a-6806-4a80-ba5d-de6f43e994b3'
  AND date = '2026-08-25'
  AND classroom_id = '9223f9ba-bc0d-4ab9-9635-423951441b62';

-- ------------------------------------------------------------------------------
-- 3. Samika Krishna (e2c88351-61aa-423d-910b-54ea640e660c)
-- Restoring 4 Friday rows from Tuesday Slot 1 -> Friday Slot 1 (Online - 7 AM)
-- Target: 6082a222-afa4-4211-bec4-9eb61433d9c7
-- ------------------------------------------------------------------------------
UPDATE public.attendance
SET classroom_id = '6082a222-afa4-4211-bec4-9eb61433d9c7'
WHERE id = '90719eb3-8d85-47e7-b2cb-dae5ba3a6213'
  AND student_id = 'e2c88351-61aa-423d-910b-54ea640e660c'
  AND date = '2026-08-07'
  AND classroom_id = '58e54509-093a-4763-a056-ab5f1ac64495';

UPDATE public.attendance
SET classroom_id = '6082a222-afa4-4211-bec4-9eb61433d9c7'
WHERE id = '65937dc1-5285-4017-825d-0bd256f0044a'
  AND student_id = 'e2c88351-61aa-423d-910b-54ea640e660c'
  AND date = '2026-08-14'
  AND classroom_id = '58e54509-093a-4763-a056-ab5f1ac64495';

UPDATE public.attendance
SET classroom_id = '6082a222-afa4-4211-bec4-9eb61433d9c7'
WHERE id = '22a3dadf-e466-4065-9187-c89f67e0487c'
  AND student_id = 'e2c88351-61aa-423d-910b-54ea640e660c'
  AND date = '2026-08-21'
  AND classroom_id = '58e54509-093a-4763-a056-ab5f1ac64495';

UPDATE public.attendance
SET classroom_id = '6082a222-afa4-4211-bec4-9eb61433d9c7'
WHERE id = '3d554e41-df20-4f44-925e-b542979d2d18'
  AND student_id = 'e2c88351-61aa-423d-910b-54ea640e660c'
  AND date = '2026-08-28'
  AND classroom_id = '58e54509-093a-4763-a056-ab5f1ac64495';

-- ------------------------------------------------------------------------------
-- 4. Kunal Thacker (736301b5-f20b-4b83-ae87-46f84cecb55a)
-- Restoring 2 Saturday rows from KFA Learning Circle -> Saturday Slot 12 (Online - 7:30 PM)
-- Target: 83f78aff-f957-4c2e-9b91-2f29b10ad16b
-- ------------------------------------------------------------------------------
UPDATE public.attendance
SET classroom_id = '83f78aff-f957-4c2e-9b91-2f29b10ad16b'
WHERE id = 'b16bf0e0-8ae0-4cae-84d8-97c7bb69097b'
  AND student_id = '736301b5-f20b-4b83-ae87-46f84cecb55a'
  AND date = '2026-08-22'
  AND classroom_id = '9223f9ba-bc0d-4ab9-9635-423951441b62';

UPDATE public.attendance
SET classroom_id = '83f78aff-f957-4c2e-9b91-2f29b10ad16b'
WHERE id = '8152d138-673a-4d89-b483-b04a7dbc2a88'
  AND student_id = '736301b5-f20b-4b83-ae87-46f84cecb55a'
  AND date = '2026-08-29'
  AND classroom_id = '9223f9ba-bc0d-4ab9-9635-423951441b62';

-- ------------------------------------------------------------------------------
-- 5. Nilip Dutta (bb258d49-6cbc-48c8-b536-ec5fa70bdfed)
-- Restoring 1 Saturday row from KFA Learning Circle -> Saturday Slot 2 (Offline - 9 AM)
-- Target: 6126cb55-9616-486c-88b5-5c15724508bf
-- ------------------------------------------------------------------------------
UPDATE public.attendance
SET classroom_id = '6126cb55-9616-486c-88b5-5c15724508bf'
WHERE id = '2c00ac92-43cf-488e-990e-dc455e1b647b'
  AND student_id = 'bb258d49-6cbc-48c8-b536-ec5fa70bdfed'
  AND date = '2026-08-29'
  AND classroom_id = '9223f9ba-bc0d-4ab9-9635-423951441b62';

-- ------------------------------------------------------------------------------
-- 6. Hrishikesh Deodhar (96c92402-e649-485f-9b18-7e0559d26f2f)
-- Restoring 2 proven Friday rows from KFA Learning Circle -> Friday Slot 3 (online - 9 AM)
-- Target: c140fe42-b103-41e7-b7f8-46be995e59bd
-- ------------------------------------------------------------------------------
UPDATE public.attendance
SET classroom_id = 'c140fe42-b103-41e7-b7f8-46be995e59bd'
WHERE id = 'e88c60e6-aa48-4dbc-8661-fbe9aaf50bf2'
  AND student_id = '96c92402-e649-485f-9b18-7e0559d26f2f'
  AND date = '2026-08-14'
  AND classroom_id = '9223f9ba-bc0d-4ab9-9635-423951441b62';

UPDATE public.attendance
SET classroom_id = 'c140fe42-b103-41e7-b7f8-46be995e59bd'
WHERE id = '93b35898-38d5-47de-b616-9dc4a50a0f8b'
  AND student_id = '96c92402-e649-485f-9b18-7e0559d26f2f'
  AND date = '2026-08-21'
  AND classroom_id = '9223f9ba-bc0d-4ab9-9635-423951441b62';

-- ------------------------------------------------------------------------------
-- 7. Pranshu (2a31496d-e59f-4b66-9309-95164afc7078)
-- Restoring 1 proven row from Tuesday Slot 2 -> Temp Pranshu (explicit override)
-- Target: 4a77cf6d-2bfd-40f0-a156-e8dc6c88fa4c
-- ------------------------------------------------------------------------------
UPDATE public.attendance
SET classroom_id = '4a77cf6d-2bfd-40f0-a156-e8dc6c88fa4c'
WHERE id = '0c958065-6354-4116-9729-5d91c0598314'
  AND student_id = '2a31496d-e59f-4b66-9309-95164afc7078'
  AND date = '2026-08-06'
  AND classroom_id = 'b6495cac-5cee-4bf8-828e-5eaa5582da02';

-- End of guarded migration
