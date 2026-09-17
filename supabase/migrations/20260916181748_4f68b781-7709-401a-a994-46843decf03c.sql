ALTER TABLE public.task_recurrences ADD COLUMN IF NOT EXISTS horizon_days integer NOT NULL DEFAULT 14;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS linked_inspection_id uuid REFERENCES public.bicycle_inspections(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_linked_inspection_id_idx ON public.tasks (linked_inspection_id);
CREATE INDEX IF NOT EXISTS tasks_linked_order_id_idx ON public.tasks (linked_order_id);