ALTER TABLE public.workshop_settings
  ADD COLUMN IF NOT EXISTS overdue_inspection_days integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS overdue_parts_unordered_days integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS overdue_parts_ordered_days integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS overdue_repair_days integer NOT NULL DEFAULT 2;

CREATE TABLE public.inspection_chases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stage text NOT NULL,
  days_in_stage numeric,
  sent_to text,
  sent_by_id uuid,
  sent_by_name text,
  automatic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inspection_chases TO authenticated;
GRANT ALL ON public.inspection_chases TO service_role;
ALTER TABLE public.inspection_chases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view chases" ON public.inspection_chases FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role::text IN ('admin','mechanic')));
CREATE INDEX inspection_chases_order_idx ON public.inspection_chases(order_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.invoke_workshop_overdue_digest()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s text;
BEGIN
  s := get_cron_secret();
  PERFORM net.http_post(
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/workshop-overdue',
    headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret', s),
    body := jsonb_build_object('action','digest')
  );
END; $$;
REVOKE ALL ON FUNCTION public.invoke_workshop_overdue_digest() FROM PUBLIC, anon, authenticated;

-- 07:00 and 08:00 UTC; the function only sends when it is 8am in London.
SELECT cron.schedule('workshop-overdue-digest', '0 7,8 * * 1-5', $$SELECT public.invoke_workshop_overdue_digest();$$);