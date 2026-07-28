UPDATE public.orders
SET is_northern_ireland = true,
    destination_region = 'Northern Ireland',
    foam_status = 'pending_collection',
    foam_pending_collection_at = COALESCE(foam_pending_collection_at, now()),
    updated_at = now()
WHERE tracking_number = 'CCC754877137960COLBT4';