CREATE TABLE public.role_route_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.user_role NOT NULL,
  route_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, route_key)
);

GRANT SELECT ON public.role_route_permissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.role_route_permissions TO authenticated;
GRANT ALL ON public.role_route_permissions TO service_role;

ALTER TABLE public.role_route_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read route permissions"
ON public.role_route_permissions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can insert route permissions"
ON public.role_route_permissions FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update route permissions"
ON public.role_route_permissions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete route permissions"
ON public.role_route_permissions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_role_route_permissions_updated_at
BEFORE UPDATE ON public.role_route_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();