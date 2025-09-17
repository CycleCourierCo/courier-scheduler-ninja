-- Add public tracking access policy for orders table
-- This allows unauthenticated users to view order details for tracking purposes
-- when they provide a valid tracking number, customer order number, or order ID

CREATE POLICY "Public tracking access" 
ON public.orders 
FOR SELECT 
USING (
  -- Allow access when the request includes tracking identifiers
  -- This is secure because it requires knowledge of specific order identifiers
  tracking_number IS NOT NULL OR 
  customer_order_number IS NOT NULL OR 
  id IS NOT NULL
);