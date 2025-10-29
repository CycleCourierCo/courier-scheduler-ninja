-- Add QuickBooks bill tracking columns to timeslips table
ALTER TABLE public.timeslips
ADD COLUMN IF NOT EXISTS quickbooks_bill_id TEXT,
ADD COLUMN IF NOT EXISTS quickbooks_bill_number TEXT,
ADD COLUMN IF NOT EXISTS quickbooks_bill_url TEXT,
ADD COLUMN IF NOT EXISTS quickbooks_bill_created_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_timeslips_qb_bill_id 
ON public.timeslips(quickbooks_bill_id) 
WHERE quickbooks_bill_id IS NOT NULL;