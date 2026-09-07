CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','cs_agent','route_planner','loader','driver','sales','timeslip_admin','mechanic','project_manager')
  )
$$;

DELETE FROM public.role_route_permissions
WHERE role = 'b2b_customer' AND route_key = 'tasks';

INSERT INTO public.role_route_permissions (role, route_key, allowed)
VALUES ('project_manager', 'project-management', true),
       ('project_manager', 'profile', true),
       ('project_manager', 'tasks', true)
ON CONFLICT DO NOTHING;