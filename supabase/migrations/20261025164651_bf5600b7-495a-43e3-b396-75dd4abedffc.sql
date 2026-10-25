
ALTER TABLE public.vehicle_issues
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS inspection_id uuid,
  ADD COLUMN IF NOT EXISTS rectification_evidence text,
  ADD COLUMN IF NOT EXISTS verified_by_name text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.vehicle_issues_validate() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.severity NOT IN ('low','medium','high') THEN RAISE EXCEPTION 'Invalid severity'; END IF;
  IF NEW.status NOT IN ('open','assessed','awaiting_parts','booked','in_repair','rectified','resolved','cancelled') THEN RAISE EXCEPTION 'Invalid defect status'; END IF;
  IF NEW.status = 'resolved' AND NEW.severity = 'high'
     AND (coalesce(trim(NEW.rectification_evidence),'') = '' OR coalesce(trim(NEW.verified_by_name),'') = '') THEN
    RAISE EXCEPTION 'A red defect needs rectification evidence and the name of the person who verified it before it can be closed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER vehicle_issues_validate BEFORE INSERT OR UPDATE ON public.vehicle_issues FOR EACH ROW EXECUTE FUNCTION public.vehicle_issues_validate();

CREATE TABLE public.fleet_inspection_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_type text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  requires_competent_inspector boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.fleet_inspection_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.fleet_inspection_templates(id) ON DELETE CASCADE,
  category text NOT NULL,
  label text NOT NULL,
  is_tyre boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.fleet_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.fleet_inspection_templates(id),
  inspection_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  inspected_at timestamptz NOT NULL DEFAULT now(),
  inspector_name text,
  inspector_organisation text,
  odometer_mi int,
  notes text,
  overall_result text,
  supersedes_id uuid REFERENCES public.fleet_inspections(id),
  correction_reason text,
  created_by uuid DEFAULT auth.uid(),
  finalised_at timestamptz,
  finalised_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fleet_inspections_vehicle_idx ON public.fleet_inspections(vehicle_id, inspected_at DESC);
CREATE TABLE public.fleet_inspection_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.fleet_inspections(id) ON DELETE CASCADE,
  template_item_id uuid REFERENCES public.fleet_inspection_template_items(id) ON DELETE SET NULL,
  category text NOT NULL,
  label text NOT NULL,
  is_tyre boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  result text NOT NULL DEFAULT 'not_checked',
  reason text,
  tread_fl numeric(4,1), tread_fr numeric(4,1), tread_rl numeric(4,1), tread_rr numeric(4,1),
  defect_id uuid REFERENCES public.vehicle_issues(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fleet_inspection_results_insp_idx ON public.fleet_inspection_results(inspection_id);
ALTER TABLE public.vehicle_issues ADD CONSTRAINT vehicle_issues_inspection_fk FOREIGN KEY (inspection_id) REFERENCES public.fleet_inspections(id) ON DELETE SET NULL;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['fleet_inspection_templates','fleet_inspection_template_items','fleet_inspections','fleet_inspection_results'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid))) WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)))', t||'_fleet_staff', t);
    EXECUTE format('CREATE TRIGGER fleet_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fleet_audit_trigger()', t);
  END LOOP;
END $$;

-- Inspection rules: lock once final; validate on finalise
CREATE OR REPLACE FUNCTION public.fleet_inspections_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE bad int; needs boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'final' THEN RAISE EXCEPTION 'Finalised inspections cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.status NOT IN ('draft','final') THEN RAISE EXCEPTION 'Invalid inspection status'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'final' THEN
    RAISE EXCEPTION 'This inspection is finalised and locked. Create a correction instead.';
  END IF;
  IF NEW.supersedes_id IS NOT NULL AND coalesce(trim(NEW.correction_reason),'') = '' THEN
    RAISE EXCEPTION 'A correction needs a reason';
  END IF;
  IF NEW.status = 'final' THEN
    SELECT requires_competent_inspector INTO needs FROM public.fleet_inspection_templates WHERE id = NEW.template_id;
    IF coalesce(needs,false) AND (coalesce(trim(NEW.inspector_name),'') = '' OR coalesce(trim(NEW.inspector_organisation),'') = '') THEN
      RAISE EXCEPTION 'Detailed mechanical inspections need the inspector name and garage';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      SELECT count(*) INTO bad FROM public.fleet_inspection_results
        WHERE inspection_id = NEW.id AND result IN ('fail','not_checked') AND coalesce(trim(reason),'') = '';
      IF bad > 0 THEN RAISE EXCEPTION '% check(s) marked Fail or Not checked need a reason', bad; END IF;
      SELECT CASE WHEN EXISTS (SELECT 1 FROM public.fleet_inspection_results WHERE inspection_id = NEW.id AND result = 'fail') THEN 'fail'
                  WHEN EXISTS (SELECT 1 FROM public.fleet_inspection_results WHERE inspection_id = NEW.id AND result = 'not_checked') THEN 'incomplete'
                  ELSE 'pass' END INTO NEW.overall_result;
    END IF;
    NEW.finalised_at := coalesce(NEW.finalised_at, now());
    NEW.finalised_by := coalesce(NEW.finalised_by, auth.uid());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER fleet_inspections_guard BEFORE INSERT OR UPDATE OR DELETE ON public.fleet_inspections FOR EACH ROW EXECUTE FUNCTION public.fleet_inspections_guard();

CREATE OR REPLACE FUNCTION public.fleet_inspection_results_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE st text; iid uuid;
BEGIN
  iid := CASE WHEN TG_OP = 'DELETE' THEN OLD.inspection_id ELSE NEW.inspection_id END;
  SELECT status INTO st FROM public.fleet_inspections WHERE id = iid;
  -- allow linking a defect to a finalised result, nothing else
  IF st = 'final' THEN
    IF TG_OP = 'UPDATE' AND NEW.result IS NOT DISTINCT FROM OLD.result AND NEW.reason IS NOT DISTINCT FROM OLD.reason
       AND NEW.tread_fl IS NOT DISTINCT FROM OLD.tread_fl AND NEW.tread_fr IS NOT DISTINCT FROM OLD.tread_fr
       AND NEW.tread_rl IS NOT DISTINCT FROM OLD.tread_rl AND NEW.tread_rr IS NOT DISTINCT FROM OLD.tread_rr THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' AND st IS NULL THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'This inspection is finalised and locked';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.result NOT IN ('pass','fail','na','not_checked') THEN RAISE EXCEPTION 'Invalid result'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER fleet_inspection_results_guard BEFORE INSERT OR UPDATE OR DELETE ON public.fleet_inspection_results FOR EACH ROW EXECUTE FUNCTION public.fleet_inspection_results_guard();

-- Seed the five checklists
DO $$
DECLARE tid uuid; typ record; it record; n int;
BEGIN
  FOR typ IN SELECT * FROM (VALUES
    ('daily_walkaround','Daily walkaround check','Quick visual check before the van is used',false,1),
    ('weekly_visual','Weekly visual safety check','Weekly visual check by staff. Not a mechanical inspection.',false,2),
    ('monthly','Monthly safety check','Fuller monthly check including fluids and equipment',false,3),
    ('detailed_mechanical','Detailed mechanical inspection','Carried out by a garage or competent inspector, separate from the weekly visual check',true,4),
    ('post_repair','Post-repair check','Check after a repair before the van returns to use',false,5)
  ) AS x(t,nm,ds,comp,o) LOOP
    INSERT INTO public.fleet_inspection_templates(inspection_type,name,description,requires_competent_inspector)
      VALUES (typ.t,typ.nm,typ.ds,typ.comp) RETURNING id INTO tid;
    n := 0;
    FOR it IN SELECT * FROM (VALUES
      ('A. Tyres and wheels','Tread depth on all tyres',true),
      ('A. Tyres and wheels','Tyre condition: cuts, bulges, sidewall damage',false),
      ('A. Tyres and wheels','Tyre pressures',false),
      ('A. Tyres and wheels','Wheel nuts secure and indicators aligned',false),
      ('B. Lights and indicators','Headlights, sidelights and rear lights',false),
      ('B. Lights and indicators','Indicators and hazard lights',false),
      ('B. Lights and indicators','Brake lights and reversing lights',false),
      ('C. Brakes','Footbrake feel and operation',false),
      ('C. Brakes','Handbrake holds',false),
      ('C. Brakes','No brake warning lights',false),
      ('D. Steering and suspension','Steering free and responsive',false),
      ('D. Steering and suspension','Suspension: no sagging or knocking',false),
      ('E. Fluids and leaks','Engine oil level',false),
      ('E. Fluids and leaks','Coolant level',false),
      ('E. Fluids and leaks','Screenwash and brake fluid',false),
      ('E. Fluids and leaks','No visible leaks under the van',false),
      ('F. Windscreen, wipers and mirrors','Windscreen free of cracks in view',false),
      ('F. Windscreen, wipers and mirrors','Wipers and washers working',false),
      ('F. Windscreen, wipers and mirrors','Mirrors secure and undamaged',false),
      ('G. Bodywork and doors','Bodywork: no sharp edges or loose panels',false),
      ('G. Bodywork and doors','Doors, locks and load doors close securely',false),
      ('G. Bodywork and doors','Number plates clean and legible',false),
      ('H. Cab and safety equipment','Seat belts work',false),
      ('H. Cab and safety equipment','Horn works',false),
      ('H. Cab and safety equipment','Dashboard warning lights clear',false),
      ('H. Cab and safety equipment','First aid kit, fire extinguisher, hi-vis present',false),
      ('I. Load area and bicycle racking','Bicycle racking secure and undamaged',false),
      ('I. Load area and bicycle racking','Straps, blankets and restraints in good condition',false),
      ('I. Load area and bicycle racking','Load area clean, floor sound, lighting works',false),
      ('J. General condition','Van clean inside and out',false),
      ('J. General condition','No new damage since last check',false)
    ) AS y(c,l,ty) LOOP
      n := n + 1;
      INSERT INTO public.fleet_inspection_template_items(template_id,category,label,is_tyre,sort_order) VALUES (tid,it.c,it.l,it.ty,n);
    END LOOP;
  END LOOP;
END $$;

-- Private storage for defect photos / documents
CREATE POLICY "Fleet staff read fleet files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fleet-files' AND EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)));
CREATE POLICY "Fleet staff upload fleet files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fleet-files' AND EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)));
CREATE POLICY "Fleet staff delete fleet files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fleet-files' AND EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)));
