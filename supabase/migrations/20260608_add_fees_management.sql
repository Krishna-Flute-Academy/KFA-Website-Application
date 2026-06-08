-- Migration: Add Fees Management columns and tables
-- Extends users table with fee fields and sets up trigger for class balance synchronization.

-- 1. Add fees columns to users table if they do not exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS fees_basis TEXT DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS fees_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS fees_collection_date DATE,
ADD COLUMN IF NOT EXISTS fees_classes_paid INTEGER DEFAULT 0;

-- 2. Create fees_payments table to track payment histories
CREATE TABLE IF NOT EXISTS public.fees_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL,
  classes_added INTEGER NOT NULL DEFAULT 4,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fees_payments ENABLE ROW LEVEL SECURITY;

-- Allow all operations for development simplicity
DROP POLICY IF EXISTS "Allow all fees_payments" ON public.fees_payments;
CREATE POLICY "Allow all fees_payments" ON public.fees_payments FOR ALL USING (true) WITH CHECK (true);

-- 3. Create fees_notifications table to track sent notifications
CREATE TABLE IF NOT EXISTS public.fees_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'due_date' or 'classes_completed'
  sent_at TIMESTAMPTZ DEFAULT now(),
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'sent'
);

-- Enable RLS
ALTER TABLE public.fees_notifications ENABLE ROW LEVEL SECURITY;

-- Allow all operations for development simplicity
DROP POLICY IF EXISTS "Allow all fees_notifications" ON public.fees_notifications;
CREATE POLICY "Allow all fees_notifications" ON public.fees_notifications FOR ALL USING (true) WITH CHECK (true);

-- 4. Trigger to automatically synchronize student's prepaid classes with attendance marks
CREATE OR REPLACE FUNCTION update_prepaid_classes_on_attendance()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status IN ('present', 'late') THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) - 1 
            WHERE id = NEW.student_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IN ('present', 'late') AND NEW.status NOT IN ('present', 'late') THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + 1 
            WHERE id = NEW.student_id;
        ELSIF OLD.status NOT IN ('present', 'late') AND NEW.status IN ('present', 'late') THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) - 1 
            WHERE id = NEW.student_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('present', 'late') THEN
            UPDATE public.users 
            SET fees_classes_paid = COALESCE(fees_classes_paid, 0) + 1 
            WHERE id = OLD.student_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger to attendance table
DROP TRIGGER IF EXISTS trg_attendance_fees_sync ON public.attendance;
CREATE TRIGGER trg_attendance_fees_sync
AFTER INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION update_prepaid_classes_on_attendance();
