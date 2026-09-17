ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS estimated_minutes integer,
  ADD COLUMN IF NOT EXISTS start_time time without time zone;

ALTER TABLE public.task_recurrences
  ADD COLUMN IF NOT EXISTS estimated_minutes integer;

DROP POLICY IF EXISTS "Admins can delete tasks" ON public.tasks;

CREATE POLICY "Admins, project managers and creators can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'project_manager'::user_role)
  OR created_by = (SELECT auth.uid())
);