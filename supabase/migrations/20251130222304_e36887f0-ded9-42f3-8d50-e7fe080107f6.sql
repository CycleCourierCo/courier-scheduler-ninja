-- Create weekly_plans table for storing route plans
CREATE TABLE IF NOT EXISTS public.weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 4),
  driver_index INTEGER NOT NULL CHECK (driver_index >= 0),
  region TEXT,
  job_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_distance_miles NUMERIC,
  is_optimized BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(week_start, day_of_week, driver_index)
);

-- Enable RLS
ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage weekly plans
CREATE POLICY "Admins can manage weekly plans"
ON public.weekly_plans
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create index for efficient queries
CREATE INDEX idx_weekly_plans_week_start ON public.weekly_plans(week_start);
CREATE INDEX idx_weekly_plans_lookup ON public.weekly_plans(week_start, day_of_week, driver_index);

-- Add trigger for updated_at
CREATE TRIGGER update_weekly_plans_updated_at
  BEFORE UPDATE ON public.weekly_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();