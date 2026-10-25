CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'order_journey',
  audience text NOT NULL DEFAULT 'customer',
  description text,
  trigger_key text,
  trigger_label text,
  delay_minutes integer NOT NULL DEFAULT 0,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  cc text[] NOT NULL DEFAULT '{}',
  bcc text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  locked boolean NOT NULL DEFAULT false,
  is_custom boolean NOT NULL DEFAULT false,
  subject text,
  preheader text,
  blocks jsonb,
  tested_at timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email templates" ON public.email_templates FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::user_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::user_role));

CREATE TABLE public.email_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  edited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.email_template_versions TO authenticated;
GRANT ALL ON public.email_template_versions TO service_role;
ALTER TABLE public.email_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read versions" ON public.email_template_versions FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::user_role));
CREATE POLICY "Admins add versions" ON public.email_template_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::user_role));

CREATE TABLE public.custom_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  send_after timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'queued',
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, order_id)
);
GRANT SELECT ON public.custom_email_sends TO authenticated;
GRANT ALL ON public.custom_email_sends TO service_role;
ALTER TABLE public.custom_email_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read custom sends" ON public.custom_email_sends FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::user_role));

CREATE OR REPLACE FUNCTION public.queue_custom_emails()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
DECLARE n int;
BEGIN
  IF TG_OP = 'INSERT' THEN k := 'order_created';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN k := 'status:' || NEW.status::text;
  ELSE RETURN NEW; END IF;
  INSERT INTO custom_email_sends (template_id, order_id, send_after)
  SELECT t.id, NEW.id, now() + make_interval(mins => t.delay_minutes)
  FROM email_templates t WHERE t.is_custom AND t.enabled AND t.trigger_key = k
  ON CONFLICT (template_id, order_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 AND EXISTS (SELECT 1 FROM custom_email_sends WHERE order_id = NEW.id AND status = 'queued' AND send_after <= now()) THEN
    PERFORM public.invoke_custom_email_dispatch();
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.queue_custom_emails() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_queue_custom_emails AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.queue_custom_emails();

CREATE OR REPLACE FUNCTION public.invoke_custom_email_dispatch()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM custom_email_sends WHERE status = 'queued' AND send_after <= now()) THEN RETURN; END IF;
  s := get_cron_secret();
  PERFORM net.http_post(
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/custom-email-dispatch',
    headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret', s),
    body := '{}'::jsonb);
END; $$;
REVOKE EXECUTE ON FUNCTION public.invoke_custom_email_dispatch() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('custom-email-dispatch', '0 * * * *', 'SELECT public.invoke_custom_email_dispatch();');

INSERT INTO public.email_templates (key, name, category, audience, trigger_label, recipients, locked) VALUES
 ('type.sender','Collection dates request','order_journey','customer','When the order is created and we need the sender''s dates','["sender"]',true),
 ('type.receiver','Delivery dates request','order_journey','customer','After the sender confirms dates','["receiver"]',true),
 ('type.sender_dates_confirmed','Sender dates confirmed','order_journey','customer','When the sender submits their dates','["sender"]',false),
 ('type.receiver_dates_confirmed','Buyer dates confirmed','order_journey','customer','When the buyer submits their dates','["receiver"]',false),
 ('update.booked_awaiting_request','Order booked','order_journey','customer','Daily update: order booked, dates not yet requested','["sender"]',false),
 ('update.awaiting_sender_dates','Chase: collection dates needed','order_journey','customer','Daily update: sender hasn''t given dates','["sender"]',false),
 ('update.awaiting_receiver_dates','Chase: delivery dates needed','order_journey','customer','Daily update: buyer hasn''t given dates','["receiver"]',false),
 ('update.sender_dates_received','Planning your collection','order_journey','customer','Daily update: sender dates received','["sender"]',false),
 ('update.collection_scheduled','Collection booked','order_journey','customer','When a collection date is booked','["sender"]',false),
 ('update.collection_scheduled_receiver','Collection booked (buyer copy)','order_journey','customer','When a collection date is booked','["receiver"]',false),
 ('update.collection_delayed','Missed collection','order_journey','customer','When a collection attempt fails','["sender"]',false),
 ('update.sender_bike_on_way','On its way to the buyer','order_journey','customer','After collection, while with us','["sender"]',false),
 ('update.delivery_scheduled','Delivery booked','order_journey','customer','When a delivery date is booked','["receiver"]',false),
 ('update.delivery_scheduled_sender','Delivery booked (sender copy)','order_journey','customer','When a delivery date is booked','["sender"]',false),
 ('update.delivery_delayed','Missed delivery','order_journey','customer','When a delivery attempt fails','["receiver"]',false);
