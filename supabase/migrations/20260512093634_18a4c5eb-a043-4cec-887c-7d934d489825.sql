CREATE TABLE public.vehicle_insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  insurer text NOT NULL,
  policy_number text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  premium numeric,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicle_insurance_policies_vehicle_dates
  ON public.vehicle_insurance_policies(vehicle_id, start_date);

ALTER TABLE public.vehicle_insurance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicle_insurance_policies_select ON public.vehicle_insurance_policies
  FOR SELECT USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY vehicle_insurance_policies_insert ON public.vehicle_insurance_policies
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY vehicle_insurance_policies_update ON public.vehicle_insurance_policies
  FOR UPDATE USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY vehicle_insurance_policies_delete ON public.vehicle_insurance_policies
  FOR DELETE USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE TRIGGER update_vehicle_insurance_policies_updated_at
  BEFORE UPDATE ON public.vehicle_insurance_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();