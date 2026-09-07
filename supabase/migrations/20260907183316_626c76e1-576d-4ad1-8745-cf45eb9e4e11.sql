ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'project_manager';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS planned_date date,
  ADD COLUMN IF NOT EXISTS recurrence_id uuid;

CREATE TABLE IF NOT EXISTS public.task_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  priority public.task_priority NOT NULL DEFAULT 'normal',
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_role public.user_role,
  frequency text NOT NULL DEFAULT 'weekdays',
  interval_n integer NOT NULL DEFAULT 1,
  days_of_week integer[] NOT NULL DEFAULT '{}',
  start_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/London')::date,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  last_generated_on date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_recurrences TO authenticated;
GRANT ALL ON public.task_recurrences TO service_role;

ALTER TABLE public.task_recurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view recurrences"
ON public.task_recurrences FOR SELECT TO authenticated
USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff can create recurrences"
ON public.task_recurrences FOR INSERT TO authenticated
WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff can update recurrences"
ON public.task_recurrences FOR UPDATE TO authenticated
USING (public.is_internal_staff(auth.uid()))
WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Admins can delete recurrences"
ON public.task_recurrences FOR DELETE TO authenticated
USING (public.is_admin());

CREATE TRIGGER update_task_recurrences_updated_at
BEFORE UPDATE ON public.task_recurrences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_task_recurrences_active ON public.task_recurrences(active);
CREATE INDEX IF NOT EXISTS idx_tasks_planned_date ON public.tasks(planned_date);
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON public.tasks(recurrence_id, planned_date);