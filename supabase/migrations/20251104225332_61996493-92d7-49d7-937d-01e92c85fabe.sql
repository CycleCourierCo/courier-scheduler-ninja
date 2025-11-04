-- Add total_jobs column to timeslips table for accurate revenue calculation
-- This will be populated for new timeslips, while historic ones will calculate dynamically
ALTER TABLE timeslips 
ADD COLUMN total_jobs integer DEFAULT NULL;

COMMENT ON COLUMN timeslips.total_jobs IS 'Total number of bikes/jobs handled (sum of bike_quantity from orders). NULL for historic records.';