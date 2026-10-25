
CREATE TABLE public.fleet_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  inspection_frequency_days int NOT NULL DEFAULT 7,
  tread_warn_mm numeric(3,1) NOT NULL DEFAULT 3,
  reminder_days int[] NOT NULL DEFAULT '{30,7,0}',
  mileage_margin_mi int NOT NULL DEFAULT 500,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.fleet_settings (id) VALUES (1);

ALTER TABLE public.vehicle_odometer_readings
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS exception_reason text,
  ADD COLUMN IF NOT EXISTS is_exception boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.vehicle_odometer_validate() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE prev int;
BEGIN
  IF NEW.source NOT IN ('manual','inspection','repair','service') THEN RAISE EXCEPTION 'Invalid mileage source'; END IF;
  IF NEW.odometer_mi < 0 THEN RAISE EXCEPTION 'Mileage cannot be negative'; END IF;
  SELECT max(odometer_mi) INTO prev FROM public.vehicle_odometer_readings
    WHERE vehicle_id = NEW.vehicle_id AND id <> NEW.id AND reading_date <= NEW.reading_date;
  IF prev IS NOT NULL AND NEW.odometer_mi < prev THEN
    IF coalesce(trim(NEW.exception_reason),'') = '' THEN
      RAISE EXCEPTION 'This reading (% mi) is lower than the last one (% mi). Give a reason to save it.', NEW.odometer_mi, prev;
    END IF;
    NEW.is_exception := true;
  ELSE
    NEW.is_exception := false;
  END IF;
  NEW.recorded_by := coalesce(NEW.recorded_by, auth.uid());
  RETURN NEW;
END $$;
CREATE TRIGGER vehicle_odometer_validate BEFORE INSERT OR UPDATE ON public.vehicle_odometer_readings FOR EACH ROW EXECUTE FUNCTION public.vehicle_odometer_validate();

CREATE TABLE public.fleet_repair_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text, email text, address text, notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fleet_repair_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  defect_id uuid REFERENCES public.vehicle_issues(id) ON DELETE SET NULL,
  interval_id uuid REFERENCES public.vehicle_maintenance_intervals(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES public.fleet_repair_providers(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'requested',
  booked_for date,
  odometer_mi int,
  quoted_cost numeric(10,2), labour_cost numeric(10,2), parts_cost numeric(10,2), vat numeric(10,2), final_cost numeric(10,2),
  invoice_ref text,
  invoice_path text,
  verified_by_name text,
  verified_at timestamptz,
  completed_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fleet_repair_jobs_vehicle_idx ON public.fleet_repair_jobs(vehicle_id, status);
ALTER TABLE public.vehicle_maintenance_logs ADD COLUMN IF NOT EXISTS repair_job_id uuid REFERENCES public.fleet_repair_jobs(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.fleet_repair_jobs_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('requested','quote_requested','quoted','approved','booked','in_progress','completed','invoiced','verified','closed','cancelled') THEN
    RAISE EXCEPTION 'Invalid repair status';
  END IF;
  IF NEW.status IN ('verified','closed') AND coalesce(trim(NEW.verified_by_name),'') = '' THEN
    RAISE EXCEPTION 'Enter who verified the repair before marking it verified or closed';
  END IF;
  IF NEW.status IN ('completed','invoiced','verified','closed') AND NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
  IF NEW.status IN ('verified','closed') AND NEW.verified_at IS NULL THEN NEW.verified_at := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER fleet_repair_jobs_guard BEFORE INSERT OR UPDATE ON public.fleet_repair_jobs FOR EACH ROW EXECUTE FUNCTION public.fleet_repair_jobs_guard();

CREATE OR REPLACE FUNCTION public.fleet_repair_jobs_after() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.defect_id IS NOT NULL AND NEW.status IN ('completed','invoiced','verified','closed')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.vehicle_issues SET status = 'rectified',
      rectification_evidence = coalesce(rectification_evidence, 'Repair job: ' || NEW.title || coalesce(' (invoice ' || NEW.invoice_ref || ')', ''))
      WHERE id = NEW.defect_id AND status NOT IN ('rectified','resolved','cancelled');
  END IF;
  IF NEW.odometer_mi IS NOT NULL AND NEW.status IN ('completed','invoiced','verified','closed')
     AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('completed','invoiced','verified','closed')) THEN
    BEGIN
      INSERT INTO public.vehicle_odometer_readings(vehicle_id, reading_date, odometer_mi, source, note)
        VALUES (NEW.vehicle_id, coalesce(NEW.completed_at, now())::date, NEW.odometer_mi, 'repair', 'From repair: ' || NEW.title);
    EXCEPTION WHEN raise_exception THEN NULL; -- lower than last reading: skip, don't block the repair
    END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fleet_repair_jobs_after AFTER INSERT OR UPDATE ON public.fleet_repair_jobs FOR EACH ROW EXECUTE FUNCTION public.fleet_repair_jobs_after();

CREATE TABLE public.fleet_tyres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  position text NOT NULL,
  brand text, model text, size text,
  fitted_date date, fitted_odometer_mi int,
  last_tread_mm numeric(4,1), last_inspected_at date,
  cost numeric(10,2), supplier text,
  removed_date date, removal_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fleet_tyres_vehicle_idx ON public.fleet_tyres(vehicle_id, position);
CREATE OR REPLACE FUNCTION public.fleet_tyres_validate() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.position NOT IN ('front_left','front_right','rear_left','rear_right','spare') THEN RAISE EXCEPTION 'Invalid tyre position'; END IF;
  IF NEW.last_tread_mm IS NOT NULL AND (NEW.last_tread_mm < 0 OR NEW.last_tread_mm > 20) THEN RAISE EXCEPTION 'Tread depth looks wrong'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER fleet_tyres_validate BEFORE INSERT OR UPDATE ON public.fleet_tyres FOR EACH ROW EXECUTE FUNCTION public.fleet_tyres_validate();

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['fleet_settings','fleet_repair_providers','fleet_repair_jobs','fleet_tyres'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid))) WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)))', t||'_fleet_staff', t);
    IF t <> 'fleet_settings' THEN
      EXECUTE format('CREATE TRIGGER fleet_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fleet_audit_trigger()', t);
    END IF;
  END LOOP;
END $$;

-- When an inspection is finalised: tyre treads, mileage, next inspection date
CREATE OR REPLACE FUNCTION public.fleet_inspections_after_final() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r record; freq int; d date;
BEGIN
  IF NEW.status <> 'final' OR (TG_OP = 'UPDATE' AND OLD.status = 'final') THEN RETURN NEW; END IF;
  d := (NEW.inspected_at AT TIME ZONE 'Europe/London')::date;
  FOR r IN SELECT * FROM public.fleet_inspection_results WHERE inspection_id = NEW.id AND is_tyre LOOP
    UPDATE public.fleet_tyres SET last_tread_mm = r.tread_fl, last_inspected_at = d WHERE vehicle_id = NEW.vehicle_id AND position = 'front_left' AND removed_date IS NULL AND r.tread_fl IS NOT NULL;
    UPDATE public.fleet_tyres SET last_tread_mm = r.tread_fr, last_inspected_at = d WHERE vehicle_id = NEW.vehicle_id AND position = 'front_right' AND removed_date IS NULL AND r.tread_fr IS NOT NULL;
    UPDATE public.fleet_tyres SET last_tread_mm = r.tread_rl, last_inspected_at = d WHERE vehicle_id = NEW.vehicle_id AND position = 'rear_left' AND removed_date IS NULL AND r.tread_rl IS NOT NULL;
    UPDATE public.fleet_tyres SET last_tread_mm = r.tread_rr, last_inspected_at = d WHERE vehicle_id = NEW.vehicle_id AND position = 'rear_right' AND removed_date IS NULL AND r.tread_rr IS NOT NULL;
  END LOOP;
  IF NEW.odometer_mi IS NOT NULL THEN
    BEGIN
      INSERT INTO public.vehicle_odometer_readings(vehicle_id, reading_date, odometer_mi, source, note)
        VALUES (NEW.vehicle_id, d, NEW.odometer_mi, 'inspection', 'From safety inspection');
    EXCEPTION WHEN raise_exception THEN NULL;
    END;
  END IF;
  IF NEW.inspection_type IN ('weekly_visual','monthly','detailed_mechanical') THEN
    SELECT inspection_frequency_days INTO freq FROM public.fleet_settings WHERE id = 1;
    UPDATE public.vehicles SET next_inspection_due = d + coalesce(freq, 7)
      WHERE id = NEW.vehicle_id AND (next_inspection_due IS NULL OR next_inspection_due < d + coalesce(freq, 7));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fleet_inspections_after_final AFTER INSERT OR UPDATE ON public.fleet_inspections FOR EACH ROW EXECUTE FUNCTION public.fleet_inspections_after_final();
