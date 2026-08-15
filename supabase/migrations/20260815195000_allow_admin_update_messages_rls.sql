-- Migration: Allow Admins and Teachers to Update Message Read Status
-- Fixes RLS blocking updates on public.messages for teacher/admin dashboard

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users select direct messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users insert direct messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users update direct messages" ON public.messages;

-- SELECT policy: Users can read messages where they are sender/receiver, or if admin/teacher
CREATE POLICY "Authenticated users select direct messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR 
    public.is_admin_or_teacher()
  );

-- INSERT policy: Users can insert messages as sender or admin/teacher
CREATE POLICY "Authenticated users insert direct messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() OR public.is_admin_or_teacher());

-- UPDATE policy: Admins/teachers or recipients can update messages (e.g. read status)
CREATE POLICY "Authenticated users update direct messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    receiver_id = auth.uid() OR 
    sender_id = auth.uid() OR 
    public.is_admin_or_teacher()
  )
  WITH CHECK (
    receiver_id = auth.uid() OR 
    sender_id = auth.uid() OR 
    public.is_admin_or_teacher()
  );
