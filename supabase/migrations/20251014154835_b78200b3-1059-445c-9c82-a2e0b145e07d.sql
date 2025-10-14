-- Add shopify_order_id column to orders table for idempotency
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shopify_order_id TEXT;

-- Create unique constraint to prevent duplicate Shopify orders
ALTER TABLE orders ADD CONSTRAINT unique_shopify_order_id UNIQUE (shopify_order_id);

-- Create index for fast duplicate detection
CREATE INDEX IF NOT EXISTS idx_orders_shopify_order_id ON orders(shopify_order_id);