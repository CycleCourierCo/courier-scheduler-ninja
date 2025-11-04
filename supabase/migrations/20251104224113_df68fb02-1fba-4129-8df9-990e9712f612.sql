-- Add mileage column to timeslips table for route profitability tracking
ALTER TABLE timeslips 
ADD COLUMN mileage numeric DEFAULT NULL;

COMMENT ON COLUMN timeslips.mileage IS 'Manually entered mileage for the timeslip, used for profitability calculations';