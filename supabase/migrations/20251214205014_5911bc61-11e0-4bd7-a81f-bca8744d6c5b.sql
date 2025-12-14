-- Add order_collected and order_delivered boolean columns
ALTER TABLE orders
ADD COLUMN order_collected boolean DEFAULT false,
ADD COLUMN order_delivered boolean DEFAULT false;

-- Populate existing orders based on confirmation timestamps and status
UPDATE orders
SET 
  order_collected = CASE
    -- If collection_confirmation_sent_at exists, mark as collected
    WHEN collection_confirmation_sent_at IS NOT NULL THEN true
    -- If status is 'delivered', mark as collected (fallback for legacy orders)
    WHEN status = 'delivered' THEN true
    -- If status indicates collection happened
    WHEN status IN ('collected', 'driver_to_delivery', 'delivery_scheduled') THEN true
    ELSE false
  END,
  order_delivered = CASE
    -- If delivery_confirmation_sent_at exists, mark as delivered
    WHEN delivery_confirmation_sent_at IS NOT NULL THEN true
    -- If status is 'delivered', mark as delivered (fallback for legacy orders)
    WHEN status = 'delivered' THEN true
    ELSE false
  END;