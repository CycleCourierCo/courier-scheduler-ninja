ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'opened';
ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'info_requested';
ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'info_provided';
ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'assessment';
ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'settlement_proposed';
ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'negotiation';
ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'settlement_agreed';

ALTER TABLE public.claim_notes
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;