ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'in_service';
ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'in_repair';
ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'mot_due';
ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'awaiting_sale';
ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'written_off';
ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'reserved';