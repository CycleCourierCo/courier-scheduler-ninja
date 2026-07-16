
-- 1. workshop_settings singleton
CREATE TABLE IF NOT EXISTS public.workshop_settings (
  id int PRIMARY KEY CHECK (id = 1) DEFAULT 1,
  hourly_rate_gbp numeric NOT NULL DEFAULT 75,
  min_charge_gbp numeric NOT NULL DEFAULT 15,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.workshop_settings TO authenticated;
GRANT INSERT, UPDATE ON public.workshop_settings TO authenticated;
GRANT ALL ON public.workshop_settings TO service_role;

ALTER TABLE public.workshop_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read workshop_settings"
  ON public.workshop_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert workshop_settings"
  ON public.workshop_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Admins can update workshop_settings"
  ON public.workshop_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::user_role));

INSERT INTO public.workshop_settings (id, hourly_rate_gbp, min_charge_gbp)
VALUES (1, 75, 15)
ON CONFLICT (id) DO NOTHING;

-- 2. Admin write policies for labour_times
GRANT INSERT, UPDATE, DELETE ON public.labour_times TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.labour_time_multipliers TO authenticated;

CREATE POLICY "Admins can insert labour_times"
  ON public.labour_times FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Admins can update labour_times"
  ON public.labour_times FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Admins can delete labour_times"
  ON public.labour_times FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can insert labour_time_multipliers"
  ON public.labour_time_multipliers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Admins can update labour_time_multipliers"
  ON public.labour_time_multipliers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "Admins can delete labour_time_multipliers"
  ON public.labour_time_multipliers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::user_role));

-- 3. Custom repair id sequence + RPC
CREATE SEQUENCE IF NOT EXISTS public.custom_repair_id_seq START 1;

CREATE OR REPLACE FUNCTION public.next_custom_repair_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Only admins can create custom repair ids';
  END IF;
  v_id := 'CUS-' || lpad(nextval('public.custom_repair_id_seq')::text, 4, '0');
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.next_custom_repair_id() FROM public;
GRANT EXECUTE ON FUNCTION public.next_custom_repair_id() TO authenticated;
