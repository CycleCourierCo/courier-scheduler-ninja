-- Add collection and delivery driver name columns to orders table
ALTER TABLE orders
ADD COLUMN collection_driver_name text,
ADD COLUMN delivery_driver_name text;

-- Create indexes for better query performance
CREATE INDEX idx_orders_collection_driver ON orders(collection_driver_name);
CREATE INDEX idx_orders_delivery_driver ON orders(delivery_driver_name);

-- Backfill existing data from tracking_events
UPDATE orders
SET collection_driver_name = (
  SELECT (update_data->>'driverName')::text
  FROM jsonb_array_elements(tracking_events->'shipday'->'updates') AS update_data
  WHERE update_data->>'orderId' = shipday_pickup_id
    AND update_data->>'event' IN ('ORDER_ASSIGNED', 'ORDER_ACCEPTED_AND_STARTED')
  ORDER BY update_data->>'timestamp' DESC
  LIMIT 1
)
WHERE shipday_pickup_id IS NOT NULL
  AND tracking_events->'shipday'->'updates' IS NOT NULL;

UPDATE orders
SET delivery_driver_name = (
  SELECT (update_data->>'driverName')::text
  FROM jsonb_array_elements(tracking_events->'shipday'->'updates') AS update_data
  WHERE update_data->>'orderId' = shipday_delivery_id
    AND update_data->>'event' IN ('ORDER_ASSIGNED', 'ORDER_ACCEPTED_AND_STARTED')
  ORDER BY update_data->>'timestamp' DESC
  LIMIT 1
)
WHERE shipday_delivery_id IS NOT NULL
  AND tracking_events->'shipday'->'updates' IS NOT NULL;