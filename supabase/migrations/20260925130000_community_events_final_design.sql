-- Forward-only correction for the Community Events schema created by
-- 20260925120000_create_community_events.sql. Do not drop events, objects, or
-- policies: existing production data and poster URLs remain intact.

-- Validate against PostgreSQL's installed IANA timezone catalogue. This is an
-- invoker function (not privileged) used only by the table CHECK constraint.
CREATE OR REPLACE FUNCTION public.is_valid_iana_timezone(p_timezone TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT p_timezone IS NOT NULL
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_timezone);
$$;

ALTER TABLE public.community_events
  ADD COLUMN IF NOT EXISTS event_timezone TEXT;

-- Existing events predate an explicit timezone. The agreed safe historical
-- default is Asia/Kolkata; no event data or poster object is removed.
UPDATE public.community_events
SET event_timezone = 'Asia/Kolkata'
WHERE event_timezone IS NULL;

ALTER TABLE public.community_events
  ALTER COLUMN event_timezone SET DEFAULT 'Asia/Kolkata',
  ALTER COLUMN event_timezone SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.community_events'::regclass
      AND conname = 'community_events_valid_iana_timezone'
  ) THEN
    ALTER TABLE public.community_events
      ADD CONSTRAINT community_events_valid_iana_timezone
      CHECK (public.is_valid_iana_timezone(event_timezone));
  END IF;
END;
$$;

-- Keep the original author-retention, active-public-read, participant-create,
-- author-edit, admin-moderation, and scoped-poster policies intact. This
-- replaces only the event trigger so timezone and overnight status are treated
-- as authored content: admins still cannot rewrite them for another author.
CREATE OR REPLACE FUNCTION public.enforce_community_event_update_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_content_changed BOOLEAN;
BEGIN
  v_is_admin := (SELECT public.is_admin());

  -- FK ON DELETE SET NULL runs without an end-user JWT. Preserve history while
  -- preventing client-originated author reassignment.
  IF NEW.author_id IS DISTINCT FROM OLD.author_id
     AND NOT (NEW.author_id IS NULL AND (SELECT auth.uid()) IS NULL) THEN
    RAISE EXCEPTION 'Cannot alter event author_id';
  END IF;
  NEW.created_at := OLD.created_at;

  v_content_changed := (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.event_type IS DISTINCT FROM OLD.event_type OR
    NEW.event_date IS DISTINCT FROM OLD.event_date OR
    NEW.start_time IS DISTINCT FROM OLD.start_time OR
    NEW.end_time IS DISTINCT FROM OLD.end_time OR
    NEW.ends_next_day IS DISTINCT FROM OLD.ends_next_day OR
    NEW.event_timezone IS DISTINCT FROM OLD.event_timezone OR
    NEW.venue IS DISTINCT FROM OLD.venue OR
    NEW.city IS DISTINCT FROM OLD.city OR
    NEW.short_description IS DISTINCT FROM OLD.short_description OR
    NEW.details IS DISTINCT FROM OLD.details OR
    NEW.performer_name IS DISTINCT FROM OLD.performer_name OR
    NEW.organizer_name IS DISTINCT FROM OLD.organizer_name OR
    NEW.poster_url IS DISTINCT FROM OLD.poster_url OR
    NEW.external_url IS DISTINCT FROM OLD.external_url
  );

  -- IS DISTINCT FROM is NULL-safe: retained events whose former author was
  -- deleted must remain immutable content even when an admin moderates them.
  IF (SELECT auth.uid()) IS DISTINCT FROM OLD.author_id AND v_is_admin AND v_content_changed THEN
    RAISE EXCEPTION 'Admins may moderate or remove events, but cannot alter the author''s event details';
  END IF;

  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    NEW.deleted_at := now();
    NEW.deleted_by := (SELECT auth.uid());
    IF NOT v_is_admin THEN
      NEW.deletion_reason := NULL;
    END IF;
  ELSIF NEW.is_deleted = true AND OLD.is_deleted = true THEN
    NEW.deleted_at := OLD.deleted_at;
    NEW.deleted_by := OLD.deleted_by;
  ELSIF NEW.is_deleted = false AND OLD.is_deleted = true THEN
    NEW.deleted_at := NULL;
    NEW.deleted_by := NULL;
    NEW.deletion_reason := NULL;
  ELSE
    NEW.deleted_at := NULL;
    NEW.deleted_by := NULL;
    NEW.deletion_reason := NULL;
  END IF;

  NEW.updated_at := CASE WHEN v_content_changed THEN now() ELSE OLD.updated_at END;
  RETURN NEW;
END;
$$;
