
CREATE TABLE public.mechanic_timeslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/London')::date),
  clock_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out_at TIMESTAMPTZ,
  clock_in_photo_url TEXT,
  clock_out_photo_url TEXT,
  clock_in_lat NUMERIC,
  clock_in_lng NUMERIC,
  clock_out_lat NUMERIC,
  clock_out_lng NUMERIC,
  location_missing BOOLEAN NOT NULL DEFAULT false,
  hourly_rate NUMERIC(8,2) NOT NULL DEFAULT 11.00,
  lunch_hours NUMERIC(5,2) NOT NULL DEFAULT 0.5,
  total_hours NUMERIC(8,2) GENERATED ALWAYS AS (
    CASE
      WHEN clock_out_at IS NULL THEN 0
      ELSE GREATEST(0, EXTRACT(EPOCH FROM (clock_out_at - clock_in_at))/3600.0 - lunch_hours)
    END
  ) STORED,
  total_pay NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE
      WHEN clock_out_at IS NULL THEN 0
      ELSE GREATEST(0, EXTRACT(EPOCH FROM (clock_out_at - clock_in_at))/3600.0 - lunch_hours) * hourly_rate
    END
  ) STORED,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','approved','rejected')),
  admin_notes TEXT,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mechanic_timeslips_driver_date ON public.mechanic_timeslips(driver_id, date DESC);
CREATE INDEX idx_mechanic_timeslips_status ON public.mechanic_timeslips(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mechanic_timeslips TO authenticated;
GRANT ALL ON public.mechanic_timeslips TO service_role;

ALTER TABLE public.mechanic_timeslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mechanic can view own timeslips"
ON public.mechanic_timeslips FOR SELECT
TO authenticated
USING (driver_id = auth.uid() OR public.is_timeslip_admin());

CREATE POLICY "Mechanic can insert own timeslip"
ON public.mechanic_timeslips FOR INSERT
TO authenticated
WITH CHECK (driver_id = auth.uid() OR public.is_timeslip_admin());

CREATE POLICY "Update own open timeslip; admins update all"
ON public.mechanic_timeslips FOR UPDATE
TO authenticated
USING (
  (driver_id = auth.uid() AND status IN ('open','closed'))
  OR public.is_timeslip_admin()
)
WITH CHECK (
  (driver_id = auth.uid() AND status IN ('open','closed'))
  OR public.is_timeslip_admin()
);

CREATE POLICY "Admins delete mechanic timeslips"
ON public.mechanic_timeslips FOR DELETE
TO authenticated
USING (public.is_timeslip_admin());

CREATE TRIGGER update_mechanic_timeslips_updated_at
BEFORE UPDATE ON public.mechanic_timeslips
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage RLS
CREATE POLICY "Mechanic upload own clock photo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'mechanic-clock-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Mechanic read own clock photo; admin read all"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'mechanic-clock-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_timeslip_admin()
  )
);

CREATE POLICY "Mechanic update own clock photo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'mechanic-clock-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
