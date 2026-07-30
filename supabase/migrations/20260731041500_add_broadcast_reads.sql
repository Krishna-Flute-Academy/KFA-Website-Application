-- Migration: Add broadcast_reads table for tracking who has read announcements/broadcasts
CREATE TABLE IF NOT EXISTS public.broadcast_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcast_id UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT unique_broadcast_user_read UNIQUE (broadcast_id, user_id)
);

-- Enable RLS
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow authenticated users to read broadcast_reads" ON public.broadcast_reads;
CREATE POLICY "Allow authenticated users to read broadcast_reads" 
  ON public.broadcast_reads 
  FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert their own broadcast_reads" ON public.broadcast_reads;
CREATE POLICY "Allow authenticated users to insert their own broadcast_reads" 
  ON public.broadcast_reads 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Enable Realtime for the table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'broadcast_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_reads;
  END IF;
END $$;
