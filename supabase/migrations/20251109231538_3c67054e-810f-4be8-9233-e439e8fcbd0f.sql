-- Fix search_path for security functions
CREATE OR REPLACE FUNCTION get_webhook_event_for_status(new_status text, old_status text)
RETURNS text AS $$
BEGIN
  -- If status didn't change, return null
  IF old_status = new_status THEN
    RETURN NULL;
  END IF;
  
  -- Map specific statuses to their webhook events
  CASE new_status
    WHEN 'created' THEN
      RETURN 'order.created';
    WHEN 'cancelled' THEN
      RETURN 'order.cancelled';
    WHEN 'driver_to_collection' THEN
      RETURN 'order.collection.started';
    WHEN 'collected' THEN
      RETURN 'order.collection.completed';
    WHEN 'driver_to_delivery' THEN
      RETURN 'order.delivery.started';
    WHEN 'delivered' THEN
      RETURN 'order.delivery.completed';
    ELSE
      -- For all other status changes
      RETURN 'order.status.updated';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Fix search_path for trigger function
CREATE OR REPLACE FUNCTION trigger_order_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_event text;
  supabase_url text;
  supabase_anon_key text;
BEGIN
  -- Get the appropriate webhook event type
  webhook_event := get_webhook_event_for_status(NEW.status::text, OLD.status::text);
  
  -- Only proceed if there's an event to trigger
  IF webhook_event IS NOT NULL THEN
    -- Set Supabase configuration
    supabase_url := 'https://axigtrmaxhetyfzjjdve.supabase.co';
    supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4aWd0cm1heGhldHlmempqZHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3NDA4MDMsImV4cCI6MjA1NzMxNjgwM30.POm5myoyMwKjkMfYMw2gRFs-cgD7GDznv338qiadugg';
    
    -- Make async HTTP call to trigger-webhook edge function
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/trigger-webhook',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_anon_key,
        'apikey', supabase_anon_key
      ),
      body := jsonb_build_object(
        'order_id', NEW.id::text,
        'event_type', webhook_event
      )
    );
    
    -- Log the webhook trigger attempt
    RAISE NOTICE 'Triggered webhook: event=%, order_id=%', webhook_event, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;