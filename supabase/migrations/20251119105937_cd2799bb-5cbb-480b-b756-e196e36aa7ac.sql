-- Create storage bucket for driver check-in images
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-checkins', 'driver-checkins', false);

-- RLS policies for storage bucket
CREATE POLICY "Drivers can upload their own check-in photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-checkins' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND has_role(auth.uid(), 'driver'::user_role)
);

CREATE POLICY "Drivers can view their own check-in photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-checkins' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND has_role(auth.uid(), 'driver'::user_role)
);

CREATE POLICY "Admins can view all check-in photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-checkins'
  AND has_role(auth.uid(), 'admin'::user_role)
);

-- Create driver_checkins table
CREATE TABLE public.driver_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  checkin_time time NOT NULL,
  fuel_photo_url text NOT NULL,
  uniform_photo_url text NOT NULL,
  is_on_time boolean GENERATED ALWAYS AS (checkin_time <= '08:15:00'::time) STORED,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(driver_id, checkin_date)
);

CREATE INDEX idx_driver_checkins_driver_date ON public.driver_checkins(driver_id, checkin_date DESC);
CREATE INDEX idx_driver_checkins_on_time ON public.driver_checkins(driver_id, is_on_time) WHERE is_on_time = true;

ALTER TABLE public.driver_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view their own check-ins"
ON public.driver_checkins FOR SELECT
TO authenticated
USING (
  driver_id = auth.uid() 
  AND has_role(auth.uid(), 'driver'::user_role)
);

CREATE POLICY "Drivers can insert their own check-ins"
ON public.driver_checkins FOR INSERT
TO authenticated
WITH CHECK (
  driver_id = auth.uid() 
  AND has_role(auth.uid(), 'driver'::user_role)
  AND checkin_date = CURRENT_DATE
);

CREATE POLICY "Admins can view all check-ins"
ON public.driver_checkins FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can manage all check-ins"
ON public.driver_checkins FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE TRIGGER update_driver_checkins_updated_at
  BEFORE UPDATE ON public.driver_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create weekly_checkin_bonuses table
CREATE TABLE public.weekly_checkin_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  total_checkins integer NOT NULL,
  on_time_checkins integer NOT NULL,
  compliance_percentage numeric(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_checkins > 0 THEN (on_time_checkins::numeric / total_checkins::numeric * 100)
      ELSE 0
    END
  ) STORED,
  bonus_awarded boolean NOT NULL DEFAULT false,
  timeslip_id uuid REFERENCES public.timeslips(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(driver_id, week_start_date)
);

CREATE INDEX idx_weekly_bonuses_driver ON public.weekly_checkin_bonuses(driver_id, week_start_date DESC);

ALTER TABLE public.weekly_checkin_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view their own bonuses"
ON public.weekly_checkin_bonuses FOR SELECT
TO authenticated
USING (
  driver_id = auth.uid() 
  AND has_role(auth.uid(), 'driver'::user_role)
);

CREATE POLICY "Admins can view all bonuses"
ON public.weekly_checkin_bonuses FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can manage all bonuses"
ON public.weekly_checkin_bonuses FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

-- Function to calculate weekly check-in compliance
CREATE OR REPLACE FUNCTION public.calculate_weekly_checkin_compliance(
  p_driver_id uuid,
  p_week_start date,
  p_week_end date
)
RETURNS TABLE (
  total_checkins integer,
  on_time_checkins integer,
  compliance_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer AS total_checkins,
    COUNT(*) FILTER (WHERE is_on_time = true)::integer AS on_time_checkins,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        (COUNT(*) FILTER (WHERE is_on_time = true)::numeric / COUNT(*)::numeric * 100)
      ELSE 0
    END AS compliance_percentage
  FROM public.driver_checkins
  WHERE driver_id = p_driver_id
    AND checkin_date BETWEEN p_week_start AND p_week_end;
END;
$$;