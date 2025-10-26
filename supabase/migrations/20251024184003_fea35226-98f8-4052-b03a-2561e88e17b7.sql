-- Add collection confirmation timestamp field to track when collection emails are sent
ALTER TABLE orders 
ADD COLUMN collection_confirmation_sent_at timestamp with time zone;

-- Add index for performance
CREATE INDEX idx_orders_collection_confirmation_sent 
ON orders(collection_confirmation_sent_at) 
WHERE collection_confirmation_sent_at IS NOT NULL;