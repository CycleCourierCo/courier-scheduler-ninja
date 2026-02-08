-- Add bikes JSONB column to orders table for structured multi-bike storage
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bikes JSONB;