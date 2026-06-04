-- Rename the table
ALTER TABLE IF EXISTS public.classroom_inventory_assignments 
  RENAME TO classroom_inventory_allocation;

-- Rename the columns to match "allocation" terminology
ALTER TABLE IF EXISTS public.classroom_inventory_allocation 
  RENAME COLUMN assigned_by TO allocated_by;

ALTER TABLE IF EXISTS public.classroom_inventory_allocation 
  RENAME COLUMN assigned_to_student_id TO allocated_to_student_id;

-- Enable Row Level Security (RLS) and update policy
ALTER TABLE public.classroom_inventory_allocation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all classroom_inventory_assignments" ON public.classroom_inventory_allocation;
DROP POLICY IF EXISTS "Allow all classroom_inventory_allocation" ON public.classroom_inventory_allocation;

CREATE POLICY "Allow all classroom_inventory_allocation" 
  ON public.classroom_inventory_allocation FOR ALL 
  USING (true) WITH CHECK (true);
