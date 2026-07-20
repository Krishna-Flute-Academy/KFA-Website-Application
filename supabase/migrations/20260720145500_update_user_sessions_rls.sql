-- Drop old policy
DROP POLICY IF EXISTS "Users can view own sessions, admins can view all" ON public.user_sessions;

-- Create updated policy to allow both admins and teachers to view sessions
CREATE POLICY "Users can view own sessions, admins and teachers can view all" ON public.user_sessions
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND (users.role = 'admin' OR users.role = 'teacher')
        )
    );
