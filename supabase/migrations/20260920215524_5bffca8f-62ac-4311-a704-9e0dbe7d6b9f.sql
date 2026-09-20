CREATE TABLE public.cs_canned_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  body text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_canned_responses TO authenticated;
GRANT ALL ON public.cs_canned_responses TO service_role;

ALTER TABLE public.cs_canned_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view canned responses"
ON public.cs_canned_responses
FOR SELECT
TO authenticated
USING (public.is_internal_staff((SELECT auth.uid())));

CREATE POLICY "Admins can insert canned responses"
ON public.cs_canned_responses
FOR INSERT
TO authenticated
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::user_role));

CREATE POLICY "Admins can update canned responses"
ON public.cs_canned_responses
FOR UPDATE
TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::user_role))
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::user_role));

CREATE POLICY "Admins can delete canned responses"
ON public.cs_canned_responses
FOR DELETE
TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::user_role));

CREATE TRIGGER update_cs_canned_responses_updated_at
BEFORE UPDATE ON public.cs_canned_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cs_canned_responses_active ON public.cs_canned_responses (is_active, sort_order);

INSERT INTO public.cs_canned_responses (title, category, body, keywords, sort_order) VALUES
('Tracking / where is my bike', 'Deliveries', E'Hi {{customer_name}},\n\nThanks for getting in touch about ticket {{ticket_ref}}.\n\nYour bike is currently showing as {{order_status}} on our system. You can follow live progress using your tracking number {{tracking_number}} at https://booking.cyclecourierco.com/tracking\n\nIf anything looks wrong, just reply to this email and we will check it straight away.\n\nKind regards,\n{{my_name}}\nCycle Courier Co.', ARRAY['where is my bike','tracking','track','where is','update on my bike','delivery status','collected yet'], 10),
('Collection date change', 'Deliveries', E'Hi {{customer_name}},\n\nThanks for letting us know. We can look at moving the collection for {{tracking_number}}.\n\nCould you confirm which weekdays work best for you over the next two weeks? Once we have that we will book the collection in and confirm the date by email.\n\nKind regards,\n{{my_name}}\nCycle Courier Co.', ARRAY['change collection','reschedule collection','move collection','collection date','pick up date','pickup date'], 20),
('Delivery date change', 'Deliveries', E'Hi {{customer_name}},\n\nNo problem — we can look at moving the delivery for {{tracking_number}}.\n\nPlease confirm the weekdays you are available and we will rebook the delivery and confirm the new date.\n\nKind regards,\n{{my_name}}\nCycle Courier Co.', ARRAY['change delivery','reschedule delivery','move delivery','delivery date','not in','away next week'], 30),
('Damage or claim - first response', 'Claims', E'Hi {{customer_name}},\n\nI am sorry to hear there is a problem with the bike. We take this seriously and will investigate right away under ticket {{ticket_ref}}.\n\nTo get started, please send us:\n- Clear photos of the damage\n- A photo of the packaging as it arrived\n- A short description of what you found\n\nAs soon as we have these we will review and come back to you with next steps.\n\nKind regards,\n{{my_name}}\nCycle Courier Co.', ARRAY['damage','damaged','broken','scratched','bent','claim','insurance','cracked'], 40),
('Invoice or payment query', 'Accounts', E'Hi {{customer_name}},\n\nThanks for your message about billing (ticket {{ticket_ref}}).\n\nI am checking this with our accounts team now and will come back to you with a full breakdown. If you have an invoice number to hand, please reply with it so we can match it up quickly.\n\nKind regards,\n{{my_name}}\nCycle Courier Co.', ARRAY['invoice','payment','paid','charge','charged','refund','vat','billing','receipt'], 50),
('Quote request', 'Accounts', E'Hi {{customer_name}},\n\nThanks for your enquiry. To give you an accurate price we just need a few details:\n\n- Collection postcode\n- Delivery postcode\n- Type of bike (road, mountain, e-bike, folding, etc.)\n- Whether you need us to box the bike\n\nOnce we have these we will send a quote straight back.\n\nKind regards,\n{{my_name}}\nCycle Courier Co.', ARRAY['quote','price','how much','cost','pricing','estimate'], 60),
('Holding reply - looking into it', 'General', E'Hi {{customer_name}},\n\nThanks for your patience on ticket {{ticket_ref}}. I am looking into this now and will come back to you as soon as I have an update.\n\nKind regards,\n{{my_name}}\nCycle Courier Co.', ARRAY['any update','chasing','following up','heard anything','still waiting'], 70);