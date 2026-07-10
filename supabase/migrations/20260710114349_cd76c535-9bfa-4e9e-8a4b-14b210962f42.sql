ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_bike_quantity_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_bike_quantity_check CHECK (bike_quantity >= 1 AND bike_quantity <= 20);