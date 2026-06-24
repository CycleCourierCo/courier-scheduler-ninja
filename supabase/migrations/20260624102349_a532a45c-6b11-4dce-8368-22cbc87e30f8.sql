CREATE TABLE public.storage_bays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  position_count integer NOT NULL CHECK (position_count > 0 AND position_count <= 100),
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.storage_bays TO authenticated;
GRANT ALL ON public.storage_bays TO service_role;

ALTER TABLE public.storage_bays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can read storage bays"
  ON public.storage_bays FOR SELECT
  TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Admins can insert storage bays"
  ON public.storage_bays FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update storage bays"
  ON public.storage_bays FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete storage bays"
  ON public.storage_bays FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::user_role));

CREATE TRIGGER storage_bays_updated_at
  BEFORE UPDATE ON public.storage_bays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.storage_bays (label, position_count, display_order)
VALUES ('A', 20, 1), ('B', 20, 2), ('C', 20, 3), ('D', 20, 4)
ON CONFLICT (label) DO NOTHING;