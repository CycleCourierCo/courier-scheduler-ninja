ALTER TABLE public.order_invoice_links ADD COLUMN IF NOT EXISTS transport_net_amount numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS large_bike_rate_from date;