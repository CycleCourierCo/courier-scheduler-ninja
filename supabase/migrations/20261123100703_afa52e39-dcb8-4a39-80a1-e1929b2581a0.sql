-- Who can see every task: admins and project managers.
CREATE OR REPLACE FUNCTION public.can_see_all_tasks(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('admin'::user_role, 'project_manager'::user_role)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_see_all_tasks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_all_tasks(uuid) TO authenticated, service_role;

-- TASKS: staff see/update only tasks assigned to them or created by them.
DROP POLICY IF EXISTS "Internal staff can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Internal staff can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Internal staff can create tasks" ON public.tasks;

CREATE POLICY "Staff view own tasks; admins and PMs view all"
ON public.tasks FOR SELECT TO authenticated
USING (
  public.can_see_all_tasks((SELECT auth.uid()))
  OR (
    public.is_internal_staff((SELECT auth.uid()))
    AND (assignee_id = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()))
  )
);

CREATE POLICY "Staff update own tasks; admins and PMs update all"
ON public.tasks FOR UPDATE TO authenticated
USING (
  public.can_see_all_tasks((SELECT auth.uid()))
  OR (
    public.is_internal_staff((SELECT auth.uid()))
    AND (assignee_id = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()))
  )
)
WITH CHECK (public.is_internal_staff((SELECT auth.uid())));

CREATE POLICY "Staff create tasks as themselves"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
  public.is_internal_staff((SELECT auth.uid()))
  AND (created_by = (SELECT auth.uid()) OR public.can_see_all_tasks((SELECT auth.uid())))
);

-- Creator can't be rewritten by a non-manager (stops claiming someone else's task).
CREATE OR REPLACE FUNCTION public.tasks_guard_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     AND auth.uid() IS NOT NULL
     AND NOT public.can_see_all_tasks(auth.uid()) THEN
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tasks_guard_created_by() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS tasks_guard_created_by ON public.tasks;
CREATE TRIGGER tasks_guard_created_by
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_guard_created_by();

-- TASK COMMENTS: follow the visibility of their task.
DROP POLICY IF EXISTS "Internal staff can view task comments" ON public.task_comments;
DROP POLICY IF EXISTS "Internal staff can add task comments" ON public.task_comments;

CREATE POLICY "Staff view comments on tasks they can see"
ON public.task_comments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_comments.task_id));

CREATE POLICY "Staff comment on tasks they can see"
ON public.task_comments FOR INSERT TO authenticated
WITH CHECK (
  public.is_internal_staff((SELECT auth.uid()))
  AND author_id = (SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_comments.task_id)
);

-- RECURRING TASKS: same rule.
DROP POLICY IF EXISTS "Internal staff can view recurrences" ON public.task_recurrences;
CREATE POLICY "Staff view own recurrences; admins and PMs view all"
ON public.task_recurrences FOR SELECT TO authenticated
USING (
  public.can_see_all_tasks((SELECT auth.uid()))
  OR (
    public.is_internal_staff((SELECT auth.uid()))
    AND (assignee_id = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()))
  )
);