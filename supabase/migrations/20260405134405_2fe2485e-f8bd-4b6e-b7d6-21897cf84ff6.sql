
CREATE TABLE public.fuel_card_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_per_litre numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.fuel_card_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fuel_card_select" ON public.fuel_card_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fuel_card_insert" ON public.fuel_card_settings
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY "fuel_card_update" ON public.fuel_card_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));
