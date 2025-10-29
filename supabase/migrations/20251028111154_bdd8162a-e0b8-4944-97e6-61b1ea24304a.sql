-- Add custom_addons column to timeslips table
ALTER TABLE timeslips 
ADD COLUMN custom_addons jsonb DEFAULT '[]'::jsonb;