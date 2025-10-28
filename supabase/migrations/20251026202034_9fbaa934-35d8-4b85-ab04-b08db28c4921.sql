-- Step 2: Update drivers table and create timeslips table
-- Update drivers table with pay and van fields
ALTER TABLE public.drivers 
  ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(8,2) DEFAULT 11.00,
  ADD COLUMN IF NOT EXISTS uses_own_van BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS van_allowance DECIMAL(8,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create timeslips table
CREATE TABLE IF NOT EXISTS public.timeslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'rejected')),
  
  -- Time tracking
  driving_hours DECIMAL(5,2) NOT NULL DEFAULT 6.00,
  stop_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  lunch_hours DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  total_hours DECIMAL(5,2) GENERATED ALWAYS AS (driving_hours + stop_hours + lunch_hours) STORED,
  
  -- Pay calculation
  hourly_rate DECIMAL(8,2) NOT NULL,
  van_allowance DECIMAL(8,2) DEFAULT 0.00,
  total_pay DECIMAL(10,2) GENERATED ALWAYS AS ((driving_hours + stop_hours + lunch_hours) * hourly_rate + van_allowance) STORED,
  
  -- Job details
  total_stops INTEGER NOT NULL DEFAULT 0,
  route_links TEXT[],
  job_locations JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  admin_notes TEXT,
  
  UNIQUE(driver_id, date)
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_timeslips_driver_date ON public.timeslips(driver_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_timeslips_status ON public.timeslips(status);

-- Enable RLS
ALTER TABLE public.timeslips ENABLE ROW LEVEL SECURITY;

-- RLS Policies for timeslips - Admins
CREATE POLICY "Admins can view all timeslips"
ON public.timeslips FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can insert timeslips"
ON public.timeslips FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update timeslips"
ON public.timeslips FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete timeslips"
ON public.timeslips FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- RLS Policies for timeslips - Drivers
CREATE POLICY "Drivers can view their approved timeslips"
ON public.timeslips FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.drivers d ON d.email = p.email
    WHERE p.id = auth.uid() 
      AND p.role = 'driver'
      AND d.id = timeslips.driver_id
      AND timeslips.status = 'approved'
  )
);

-- RLS Policies for drivers - Allow drivers to view their own record
CREATE POLICY "Drivers can view their own record"
ON public.drivers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
      AND profiles.role = 'driver'
      AND profiles.email = drivers.email
  )
);