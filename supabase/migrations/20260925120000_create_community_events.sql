-- Community Events V1: queryable event discovery with community-only participation.
-- Prepared only; do not apply automatically to a production database.

CREATE TABLE IF NOT EXISTS public.community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Events are retained as community history if an auth account is removed.
  -- This intentionally differs from the older posts/replies cascade model.
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title VARCHAR(160) NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 160),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'hindustani_classical', 'carnatic_classical', 'flute_bansuri', 'vocal',
    'tabla_percussion', 'instrumental', 'workshop_masterclass', 'festival',
    'academy_event', 'other_music_event'
  )),
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  ends_next_day BOOLEAN NOT NULL DEFAULT false,
  venue VARCHAR(160) NOT NULL CHECK (char_length(trim(venue)) BETWEEN 2 AND 160),
  city VARCHAR(100) NOT NULL CHECK (char_length(trim(city)) BETWEEN 2 AND 100),
  short_description VARCHAR(600) NOT NULL CHECK (char_length(trim(short_description)) BETWEEN 10 AND 600),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 5000),
  performer_name VARCHAR(160) CHECK (performer_name IS NULL OR char_length(trim(performer_name)) BETWEEN 1 AND 160),
  organizer_name VARCHAR(160) CHECK (organizer_name IS NULL OR char_length(trim(organizer_name)) BETWEEN 1 AND 160),
  poster_url TEXT CHECK (poster_url IS NULL OR poster_url ~* '^https?://[^[:space:]/]+'),
  external_url TEXT CHECK (external_url IS NULL OR external_url ~* '^https?://[^[:space:]/]+'),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deletion_reason TEXT CHECK (deletion_reason IS NULL OR char_length(deletion_reason) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT community_events_end_time_is_coherent CHECK (
    (end_time IS NULL AND ends_next_day = false)
    OR (end_time IS NOT NULL AND (end_time > start_time OR ends_next_day = true))
  )
);

CREATE INDEX IF NOT EXISTS idx_community_events_upcoming
  ON public.community_events (event_date ASC, start_time ASC)
  WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_community_events_type_date
  ON public.community_events (event_type, event_date ASC)
  WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_community_events_city_date
  ON public.community_events (lower(city), event_date ASC)
  WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_community_events_author
  ON public.community_events (author_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_events_active_author_time
  ON public.community_events (author_id, lower(title), event_date, start_time, lower(venue))
  WHERE is_deleted = false AND author_id IS NOT NULL;

ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;

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
  -- still preventing every client-originated author reassignment.
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
    NEW.venue IS DISTINCT FROM OLD.venue OR
    NEW.city IS DISTINCT FROM OLD.city OR
    NEW.short_description IS DISTINCT FROM OLD.short_description OR
    NEW.details IS DISTINCT FROM OLD.details OR
    NEW.performer_name IS DISTINCT FROM OLD.performer_name OR
    NEW.organizer_name IS DISTINCT FROM OLD.organizer_name OR
    NEW.poster_url IS DISTINCT FROM OLD.poster_url OR
    NEW.external_url IS DISTINCT FROM OLD.external_url
  );

  -- Moderators may remove/restore content, but never rewrite its author.
  IF (SELECT auth.uid()) <> OLD.author_id AND v_is_admin AND v_content_changed THEN
    RAISE EXCEPTION 'Admins may moderate or remove events, but cannot alter the author''s event details';
  END IF;

  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    NEW.deleted_at := now();
    NEW.deleted_by := (SELECT auth.uid());
    IF NOT v_is_admin THEN
      NEW.deletion_reason := NULL;
    END IF;
  ELSIF NEW.is_deleted = true AND OLD.is_deleted = true THEN
    -- Deletion attribution is audit data, not editable event content. An admin
    -- may still amend the moderation reason without rewriting the event.
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

DROP TRIGGER IF EXISTS trg_enforce_community_event_update_rules ON public.community_events;
CREATE TRIGGER trg_enforce_community_event_update_rules
BEFORE UPDATE ON public.community_events
FOR EACH ROW EXECUTE FUNCTION public.enforce_community_event_update_rules();

GRANT SELECT ON public.community_events TO anon, authenticated;
GRANT INSERT, UPDATE ON public.community_events TO authenticated;

CREATE POLICY "Community events are publicly readable when active"
  ON public.community_events FOR SELECT
  USING (is_deleted = false OR (SELECT auth.uid()) = author_id OR (SELECT public.is_admin()));

CREATE POLICY "Community participants can create own events"
  ON public.community_events FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = author_id AND (SELECT public.is_community_participant()));

CREATE POLICY "Authors edit active events; admins moderate events"
  ON public.community_events FOR UPDATE TO authenticated
  USING (((SELECT auth.uid()) = author_id AND is_deleted = false) OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = author_id OR (SELECT public.is_admin()));

-- Event poster storage is deliberately isolated from broad legacy image buckets.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-event-posters', 'community-event-posters', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public buckets serve known object URLs without a listing policy. Keep storage
-- enumeration restricted; the owner SELECT policy also supports upload returns.
CREATE POLICY "Event poster owners can read upload results"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'community-event-posters' AND owner_id = (SELECT auth.uid()::text));

CREATE POLICY "Community participants upload own event posters"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-event-posters'
    AND owner_id = (SELECT auth.uid()::text)
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
    AND (SELECT public.is_community_participant())
  );

CREATE POLICY "Owners update own event posters"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'community-event-posters' AND owner_id = (SELECT auth.uid()::text))
  WITH CHECK (
    bucket_id = 'community-event-posters'
    AND owner_id = (SELECT auth.uid()::text)
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
    AND (SELECT public.is_community_participant())
  );

CREATE POLICY "Owners and admins delete event posters"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community-event-posters' AND (owner_id = (SELECT auth.uid()::text) OR (SELECT public.is_admin())));
