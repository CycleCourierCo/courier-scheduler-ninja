-- Add new fields to orders table for eBay orders and payment collection phone
ALTER TABLE public.orders 
ADD COLUMN is_ebay_order boolean DEFAULT false,
ADD COLUMN collection_code text,
ADD COLUMN payment_collection_phone text,
ADD COLUMN bike_quantity integer DEFAULT 1 CHECK (bike_quantity >= 1 AND bike_quantity <= 8);

-- Update existing orders to have bike_quantity = 1 for backward compatibility
UPDATE public.orders SET bike_quantity = 1 WHERE bike_quantity IS NULL;