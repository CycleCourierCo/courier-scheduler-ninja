
-- Helper: identify internal staff (excludes customers)
CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','cs_agent','route_planner','loader','driver','sales','timeslip_admin','mechanic')
  );
$$;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('open','in_progress','blocked','done','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tasks
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'open',
  priority public.task_priority NOT NULL DEFAULT 'normal',
  due_date timestamptz,
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  linked_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  linked_conversation_id uuid REFERENCES public.cs_conversations(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff can create tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff can update tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Admins can delete tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX tasks_assignee_idx ON public.tasks(assignee_id);
CREATE INDEX tasks_status_idx ON public.tasks(status);
CREATE INDEX tasks_linked_order_idx ON public.tasks(linked_order_id);
CREATE INDEX tasks_linked_conv_idx ON public.tasks(linked_conversation_id);
CREATE INDEX tasks_due_idx ON public.tasks(due_date);

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-set completed_at when status changes to done/cancelled
CREATE OR REPLACE FUNCTION public.tasks_handle_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('done','cancelled') AND (OLD.status IS DISTINCT FROM NEW.status) AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  ELSIF NEW.status NOT IN ('done','cancelled') AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_completion_trigger
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_handle_completion();

-- Task comments
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view task comments"
  ON public.task_comments FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff can add task comments"
  ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()) AND author_id = auth.uid());

CREATE POLICY "Authors or admins can update task comments"
  ON public.task_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Authors or admins can delete task comments"
  ON public.task_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE INDEX task_comments_task_idx ON public.task_comments(task_id);

CREATE TRIGGER task_comments_set_updated_at
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.task_comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;

-- Helper: list internal users for assignee dropdown (avoids leaking full profiles)
CREATE OR REPLACE FUNCTION public.list_internal_users()
RETURNS TABLE(id uuid, name text, email text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.name, p.email
  FROM public.profiles p
  WHERE public.is_internal_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.id
        AND ur.role IN ('admin','cs_agent','route_planner','loader','driver','sales','timeslip_admin','mechanic')
    )
  ORDER BY p.name NULLS LAST, p.email;
$$;

GRANT EXECUTE ON FUNCTION public.list_internal_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_staff(uuid) TO authenticated;
