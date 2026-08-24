-- Part 1C: Student Progress, Inventory & Push Subscriptions
CREATE INDEX IF NOT EXISTS idx_student_topic_progress_student_id ON public.student_topic_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_student_topic_progress_student_lesson ON public.student_topic_progress(student_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_classroom_inventory_alloc_student ON public.classroom_inventory_allocation(allocated_to_student_id);
CREATE INDEX IF NOT EXISTS idx_classroom_inventory_alloc_classroom ON public.classroom_inventory_allocation(classroom_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
