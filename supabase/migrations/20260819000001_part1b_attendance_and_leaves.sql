-- Part 1B: Attendance & Leave Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_classroom_date ON public.attendance(classroom_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_classroom_status ON public.leave_requests(classroom_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
