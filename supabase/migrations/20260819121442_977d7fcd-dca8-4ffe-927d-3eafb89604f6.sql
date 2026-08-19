CREATE TABLE public.bike_type_spaces (
  bike_type text PRIMARY KEY,
  spaces numeric NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bike_type_spaces TO authenticated;
GRANT ALL ON public.bike_type_spaces TO service_role;

ALTER TABLE public.bike_type_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view bike type spaces"
ON public.bike_type_spaces FOR SELECT TO authenticated
USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Admins can insert bike type spaces"
ON public.bike_type_spaces FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bike type spaces"
ON public.bike_type_spaces FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bike type spaces"
ON public.bike_type_spaces FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.workshop_settings
  ADD COLUMN IF NOT EXISTS van_spaces_capacity numeric NOT NULL DEFAULT 10;

INSERT INTO public.bike_type_spaces (bike_type, spaces) VALUES
  ('Boxed Kids Bikes', 0.5),
  ('Wheelset/Frameset', 0.5),
  ('Kids Bikes', 0.5),
  ('BMX Bikes', 0.5),
  ('Bike Rack', 0.5),
  ('Turbo Trainer', 1),
  ('Folding Bikes', 0.5),
  ('Non-Electric Bikes', 1),
  ('Travel Bike Boxes', 1),
  ('Electric Bikes under 25kg', 1),
  ('Electric Bikes over 25kg', 1.5),
  ('Longtail Cargo Bikes', 2.5),
  ('Stationary Bikes', 1.5),
  ('Tandem Bikes', 2),
  ('Recumbent', 2),
  ('Small Trike', 2),
  ('Large Trike', 2.5),
  ('Double Seat/Platform/Cargo Trikes', 3),
  ('Non-Electric - Mountain Bike', 1),
  ('Non-Electric - Road Bike', 1),
  ('Non-Electric - Hybrid', 1),
  ('Non-Electric - Gravel Bike', 1),
  ('Electric Bike - Under 25kg', 1),
  ('Electric Bike - Over 25kg', 1.5),
  ('Cargo Bike', 2.5),
  ('Longtail Cargo Bike', 2.5),
  ('Stationary Bike', 1.5),
  ('Tandem', 2),
  ('Travel Bike Box', 1),
  ('Trike', 2.5)
ON CONFLICT (bike_type) DO NOTHING;