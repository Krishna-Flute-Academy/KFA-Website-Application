-- Migration: Create leave_requests table to support Advanced Leave Requests (Excused vs Absent)

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    class_date DATE NOT NULL,
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- 3. Allow all operations for simplicity in development (matching other tables like classroom_students, batch_schedules, attendance)
DROP POLICY IF EXISTS "Allow all leave_requests" ON public.leave_requests;
CREATE POLICY "Allow all leave_requests" 
  ON public.leave_requests FOR ALL 
  USING (true) 
  WITH CHECK (true);
