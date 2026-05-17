CREATE TABLE public.allowed_fridays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT allowed_fridays_is_friday CHECK (EXTRACT(DOW FROM date) = 5)
);

ALTER TABLE public.allowed_fridays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allowed fridays are publicly readable"
  ON public.allowed_fridays FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert allowed fridays"
  ON public.allowed_fridays FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete allowed fridays"
  ON public.allowed_fridays FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));