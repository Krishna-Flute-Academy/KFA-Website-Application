create table if not exists classroom_inventory_allocation (
  id uuid primary key default uuid_generate_v4(),
  classroom_id uuid references classrooms(id) on delete cascade,
  module_id uuid references course_modules(id) on delete set null,
  chapter_id uuid references course_chapters(id) on delete set null,
  lesson_id uuid references course_lessons(id) on delete set null,
  allocated_by uuid references users(id),
  allocated_to_student_id uuid references users(id),
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.classroom_inventory_allocation ENABLE ROW LEVEL SECURITY;

-- Allow all policy
DROP POLICY IF EXISTS "Allow all classroom_inventory_allocation" ON public.classroom_inventory_allocation;
CREATE POLICY "Allow all classroom_inventory_allocation"
  ON public.classroom_inventory_allocation FOR ALL
  USING (true) WITH CHECK (true);
