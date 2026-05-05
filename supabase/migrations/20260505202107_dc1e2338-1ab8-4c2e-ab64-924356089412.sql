-- Enums
CREATE TYPE public.claim_status AS ENUM ('open','awaiting_info','under_review','offer_made','settled','rejected','closed');
CREATE TYPE public.claim_damage_type AS ENUM ('visible','concealed','loss','missing_parts');

-- claims table
CREATE TABLE public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_ref text UNIQUE,
  status public.claim_status NOT NULL DEFAULT 'open',
  -- Booking
  booking_ref text NOT NULL,
  order_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  collection_date date,
  delivery_date date,
  route_name text,
  driver_name text,
  -- Bike
  bike_make_model text,
  declared_value numeric,
  has_upgrades boolean DEFAULT false,
  upgrades_notes text,
  -- Damage
  damage_type public.claim_damage_type,
  damage_description text,
  recorded_at_delivery text,
  notification_date date,
  within_timeframe boolean,
  -- Evidence checklist
  ev_booking_ref boolean DEFAULT false,
  ev_pre_collection_photos boolean DEFAULT false,
  ev_delivery_photos boolean DEFAULT false,
  ev_full_bike_photos boolean DEFAULT false,
  ev_proof_ownership boolean DEFAULT false,
  ev_proof_value boolean DEFAULT false,
  ev_upgrade_details boolean DEFAULT false,
  ev_repair_estimate boolean DEFAULT false,
  ev_delivery_note boolean DEFAULT false,
  -- Assessment
  claim_kind text,
  assessor_appointed boolean DEFAULT false,
  assessor_name text,
  repair_quote numeric,
  market_value numeric,
  betterment boolean DEFAULT false,
  betterment_amount numeric,
  betterment_reason text,
  recommended_settlement numeric,
  settlement_override_reason text,
  -- Settlement
  offer_amount numeric,
  offer_date date,
  offer_accepted text,
  payment_reference text,
  settlement_notes text,
  title_transferred boolean DEFAULT false,
  -- Internal
  internal_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- evidence files
CREATE TABLE public.claim_evidence_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  label text,
  kind text NOT NULL DEFAULT 'photo',
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- notes
CREATE TABLE public.claim_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  author_id uuid,
  author_name text,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- status log
CREATE TABLE public.claim_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  from_status public.claim_status,
  to_status public.claim_status NOT NULL,
  changed_by uuid,
  changed_by_name text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

-- claim_ref generator (yearly counter)
CREATE TABLE public.claim_ref_counters (
  year int PRIMARY KEY,
  last_value int NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.set_claim_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM now())::int;
  v_next int;
BEGIN
  IF NEW.claim_ref IS NOT NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.claim_ref_counters(year, last_value)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = claim_ref_counters.last_value + 1
  RETURNING last_value INTO v_next;
  NEW.claim_ref := 'CLM-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER claims_set_ref
BEFORE INSERT ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.set_claim_ref();

-- updated_at trigger
CREATE TRIGGER claims_updated_at
BEFORE UPDATE ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- status log trigger
CREATE OR REPLACE FUNCTION public.log_claim_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(name, email) INTO v_name FROM public.profiles WHERE id = NEW.created_by;
    INSERT INTO public.claim_status_log(claim_id, from_status, to_status, changed_by, changed_by_name)
    VALUES (NEW.id, NULL, NEW.status, NEW.created_by, v_name);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT COALESCE(name, email) INTO v_name FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.claim_status_log(claim_id, from_status, to_status, changed_by, changed_by_name)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), v_name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER claims_status_log_ins
AFTER INSERT ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.log_claim_status_change();

CREATE TRIGGER claims_status_log_upd
AFTER UPDATE ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.log_claim_status_change();

-- RLS
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_ref_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY claims_admin_all ON public.claims FOR ALL
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY claim_evidence_admin_all ON public.claim_evidence_files FOR ALL
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY claim_notes_admin_all ON public.claim_notes FOR ALL
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY claim_status_log_admin_select ON public.claim_status_log FOR SELECT
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

-- counters table: no client access needed; trigger runs as definer

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('claim-evidence','claim-evidence', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY claim_evidence_admin_select ON storage.objects FOR SELECT
USING (bucket_id = 'claim-evidence' AND EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY claim_evidence_admin_insert ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'claim-evidence' AND EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY claim_evidence_admin_update ON storage.objects FOR UPDATE
USING (bucket_id = 'claim-evidence' AND EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)))
WITH CHECK (bucket_id = 'claim-evidence' AND EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY claim_evidence_admin_delete ON storage.objects FOR DELETE
USING (bucket_id = 'claim-evidence' AND EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE INDEX claims_status_idx ON public.claims(status);
CREATE INDEX claims_created_at_idx ON public.claims(created_at DESC);
CREATE INDEX claim_evidence_claim_idx ON public.claim_evidence_files(claim_id);
CREATE INDEX claim_notes_claim_idx ON public.claim_notes(claim_id, created_at);
CREATE INDEX claim_status_log_claim_idx ON public.claim_status_log(claim_id, changed_at);