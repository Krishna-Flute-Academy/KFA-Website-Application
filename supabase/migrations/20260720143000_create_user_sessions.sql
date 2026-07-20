-- Create user_sessions table to track user log in/log out sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    logout_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_seconds INTEGER,
    user_agent TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own sessions
CREATE POLICY "Users can insert their own sessions" ON public.user_sessions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own sessions (heartbeats & logouts)
CREATE POLICY "Users can update their own sessions" ON public.user_sessions
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own sessions, and admins to view all sessions
CREATE POLICY "Users can view own sessions, admins can view all" ON public.user_sessions
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );
