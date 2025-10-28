-- Add custom_addon_hours column
ALTER TABLE public.timeslips 
ADD COLUMN IF NOT EXISTS custom_addon_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00;

-- Drop existing generated columns
ALTER TABLE public.timeslips 
DROP COLUMN IF EXISTS total_hours CASCADE,
DROP COLUMN IF EXISTS total_pay CASCADE;

-- Recreate total_hours with custom_addon_hours included
ALTER TABLE public.timeslips 
ADD COLUMN total_hours DECIMAL(5,2) 
GENERATED ALWAYS AS (driving_hours + stop_hours + lunch_hours + custom_addon_hours) STORED;

-- Recreate total_pay with updated formula
ALTER TABLE public.timeslips 
ADD COLUMN total_pay DECIMAL(10,2) 
GENERATED ALWAYS AS ((driving_hours + stop_hours + lunch_hours + custom_addon_hours) * hourly_rate + van_allowance) STORED;

-- Update existing timeslips to calculate custom_addon_hours from JSONB
UPDATE public.timeslips
SET custom_addon_hours = (
  SELECT COALESCE(SUM((addon->>'hours')::DECIMAL), 0)
  FROM jsonb_array_elements(custom_addons) AS addon
)
WHERE custom_addons IS NOT NULL AND jsonb_array_length(custom_addons) > 0;