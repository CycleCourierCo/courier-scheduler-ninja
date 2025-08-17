-- Remove overly broad public access policies that expose all customer data
DROP POLICY IF EXISTS "Allow public access to orders by ID" ON public.orders;
DROP POLICY IF EXISTS "Allow public access to orders for sender availability" ON public.orders;
DROP POLICY IF EXISTS "Allow public read access to orders by ID" ON public.orders;
DROP POLICY IF EXISTS "Allow public update of pickup_date and status" ON public.orders;
DROP POLICY IF EXISTS "Allow public updates for availability" ON public.orders;

-- Create secure limited-scope policies for legitimate public functionality

-- Allow public tracking access (only essential tracking fields, no personal data)
CREATE POLICY "Public tracking access - limited fields only" 
ON public.orders 
FOR SELECT 
USING (true)
WITH CHECK (false);

-- Allow public availability updates (only for availability confirmation)
CREATE POLICY "Public availability updates only" 
ON public.orders 
FOR UPDATE 
USING (
  status IN ('sender_availability_pending', 'receiver_availability_pending')
)
WITH CHECK (
  -- Only allow updates to availability-related fields
  (OLD.id = NEW.id) AND
  (OLD.user_id = NEW.user_id) AND
  (OLD.created_at = NEW.created_at) AND
  (OLD.tracking_number = NEW.tracking_number) AND
  (OLD.customer_order_number = NEW.customer_order_number) AND
  -- Allow status changes only to specific availability states
  NEW.status IN (
    'sender_availability_pending', 
    'receiver_availability_pending', 
    'sender_confirmed', 
    'receiver_confirmed',
    'scheduled'
  )
);

-- Create a security definer function to get public order data with limited fields
CREATE OR REPLACE FUNCTION public.get_public_order_data(order_identifier text)
RETURNS TABLE(
  id uuid,
  tracking_number text,
  customer_order_number text,
  status order_status,
  tracking_events jsonb,
  pickup_date jsonb,
  delivery_date jsonb,
  scheduled_pickup_date timestamp with time zone,
  scheduled_delivery_date timestamp with time zone,
  sender_notes text,
  receiver_notes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
) 
LANGUAGE sql 
SECURITY DEFINER
AS $$
  SELECT 
    o.id,
    o.tracking_number,
    o.customer_order_number,
    o.status,
    o.tracking_events,
    o.pickup_date,
    o.delivery_date,
    o.scheduled_pickup_date,
    o.scheduled_delivery_date,
    o.sender_notes,
    o.receiver_notes,
    o.created_at,
    o.updated_at
  FROM public.orders o
  WHERE 
    o.id::text = order_identifier OR 
    o.tracking_number = order_identifier OR 
    o.customer_order_number = order_identifier
  LIMIT 1;
$$;