ALTER TABLE public.timeslips ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_timeslips_vehicle_date ON public.timeslips(vehicle_id, date);