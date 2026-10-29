GRANT EXECUTE ON FUNCTION public.next_custom_repair_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.next_custom_repair_id() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.verify_api_key(api_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE found_user_id uuid; input_key_hash text;
BEGIN
 input_key_hash := encode(sha256(api_key::bytea), 'hex');
 UPDATE public.api_keys SET last_used_at = now() WHERE key_hash = input_key_hash AND is_active = true RETURNING user_id INTO found_user_id;
 RETURN found_user_id;
END $$;

ALTER TABLE public.fleet_inspections ADD COLUMN expected_checklist jsonb;
UPDATE public.fleet_inspections i SET expected_checklist = COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'category',t.category,'label',t.label,'is_tyre',t.is_tyre,'sort_order',t.sort_order) ORDER BY t.sort_order) FROM public.fleet_inspection_template_items t WHERE t.template_id=i.template_id AND t.active), '[]'::jsonb) WHERE i.status='draft';

CREATE OR REPLACE FUNCTION public.fleet_inspections_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE bad int; needs boolean;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.status='final' THEN RAISE EXCEPTION 'Finalised inspections cannot be deleted'; END IF;
  RETURN OLD;
 END IF;
 IF NEW.status NOT IN ('draft','final') THEN RAISE EXCEPTION 'Invalid inspection status'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status='final' THEN RAISE EXCEPTION 'Start an inspection as a draft before completing it'; END IF;
  IF NEW.supersedes_id IS NOT NULL THEN
   SELECT expected_checklist INTO NEW.expected_checklist FROM public.fleet_inspections WHERE id=NEW.supersedes_id AND status='final';
   IF NEW.expected_checklist IS NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id',r.template_item_id,'category',r.category,'label',r.label,'is_tyre',r.is_tyre,'sort_order',r.sort_order) ORDER BY r.sort_order),'[]'::jsonb) INTO NEW.expected_checklist FROM public.fleet_inspection_results r WHERE inspection_id=NEW.supersedes_id;
   END IF;
  ELSE
   SELECT COALESCE(jsonb_agg(jsonb_build_object('id',t.id,'category',t.category,'label',t.label,'is_tyre',t.is_tyre,'sort_order',t.sort_order) ORDER BY t.sort_order),'[]'::jsonb) INTO NEW.expected_checklist FROM public.fleet_inspection_template_items t WHERE template_id=NEW.template_id AND active;
  END IF;
  NEW.overall_result:=NULL; NEW.finalised_at:=NULL; NEW.finalised_by:=NULL;
 ELSE
  IF OLD.status='final' THEN RAISE EXCEPTION 'This inspection is finalised and locked. Create a correction instead.'; END IF;
  IF NEW.template_id IS DISTINCT FROM OLD.template_id OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id OR NEW.expected_checklist IS DISTINCT FROM OLD.expected_checklist THEN RAISE EXCEPTION 'The saved inspection checklist cannot be changed'; END IF;
 END IF;
 IF NEW.supersedes_id IS NOT NULL AND coalesce(trim(NEW.correction_reason),'')='' THEN RAISE EXCEPTION 'A correction needs a reason'; END IF;
 IF NEW.status='final' THEN
  IF jsonb_array_length(COALESCE(NEW.expected_checklist,'[]'::jsonb))=0 THEN RAISE EXCEPTION 'An inspection needs a checklist before it can be completed'; END IF;
  IF (SELECT count(*) FROM public.fleet_inspection_results WHERE inspection_id=NEW.id) <> jsonb_array_length(NEW.expected_checklist) OR EXISTS (
   SELECT 1 FROM jsonb_array_elements(NEW.expected_checklist) e WHERE NOT EXISTS (
    SELECT 1 FROM public.fleet_inspection_results r WHERE r.inspection_id=NEW.id AND r.template_item_id::text IS NOT DISTINCT FROM e->>'id' AND r.category=e->>'category' AND r.label=e->>'label' AND r.is_tyre=(e->>'is_tyre')::boolean AND r.sort_order=(e->>'sort_order')::int
   )
  ) THEN RAISE EXCEPTION 'Every saved checklist item must be present before completing the inspection'; END IF;
  SELECT requires_competent_inspector INTO needs FROM public.fleet_inspection_templates WHERE id=NEW.template_id;
  IF coalesce(needs,false) AND (coalesce(trim(NEW.inspector_name),'')='' OR coalesce(trim(NEW.inspector_organisation),'')='') THEN RAISE EXCEPTION 'Detailed mechanical inspections need the inspector name and garage'; END IF;
  SELECT count(*) INTO bad FROM public.fleet_inspection_results WHERE inspection_id=NEW.id AND result IN ('fail','not_checked') AND coalesce(trim(reason),'')='';
  IF bad>0 THEN RAISE EXCEPTION '% check(s) marked Fail or Not checked need a reason',bad; END IF;
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.fleet_inspection_results WHERE inspection_id=NEW.id AND result='fail') THEN 'fail' WHEN EXISTS (SELECT 1 FROM public.fleet_inspection_results WHERE inspection_id=NEW.id AND result='not_checked') THEN 'incomplete' ELSE 'pass' END INTO NEW.overall_result;
  NEW.finalised_at:=now(); NEW.finalised_by:=auth.uid();
 ELSE NEW.overall_result:=NULL; NEW.finalised_at:=NULL; NEW.finalised_by:=NULL;
 END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.fleet_inspections_guard() FROM PUBLIC,anon;

CREATE OR REPLACE FUNCTION public.fleet_inspection_results_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE st text; iid uuid;
BEGIN
 IF TG_OP='UPDATE' AND NEW.inspection_id IS DISTINCT FROM OLD.inspection_id THEN RAISE EXCEPTION 'Inspection results cannot be moved to another inspection'; END IF;
 iid:=CASE WHEN TG_OP='DELETE' THEN OLD.inspection_id ELSE NEW.inspection_id END;
 SELECT status INTO st FROM public.fleet_inspections WHERE id=iid FOR UPDATE;
 IF TG_OP='DELETE' AND st IS NULL THEN RETURN OLD; END IF;
 IF st='final' THEN
  IF TG_OP='UPDATE' AND to_jsonb(NEW)-ARRAY['defect_id','vehicle_issue_id','updated_at']=to_jsonb(OLD)-ARRAY['defect_id','vehicle_issue_id','updated_at'] THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'This inspection is finalised and locked';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.result NOT IN ('pass','fail','na','not_checked') THEN RAISE EXCEPTION 'Invalid result'; END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.fleet_inspection_results_guard() FROM PUBLIC,anon;

CREATE OR REPLACE FUNCTION public.driver_can_upload_proof_file(_name text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE parts text[]; oid uuid; pid uuid; captured timestamptz;
BEGIN
 parts:=string_to_array(_name,'/');
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'driver') OR cardinality(parts)<>4 OR parts[1]<>auth.uid()::text THEN RETURN false; END IF;
 IF parts[4] !~ '^(photo-[1-9][0-9]*\.jpg|signature\.png)$' THEN RETURN false; END IF;
 BEGIN oid:=parts[2]::uuid; pid:=parts[3]::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
 IF EXISTS(SELECT 1 FROM public.delivery_proofs WHERE id=pid) THEN RETURN false; END IF;
 -- Offline uploads may arrive after the assigned day; the committed row separately checks actual capture time.
 RETURN EXISTS(SELECT 1 FROM public.saved_route_assignments sa JOIN public.saved_routes r ON r.id=sa.saved_route_id WHERE sa.driver_id=auth.uid() AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(r.job_data,'[]'::jsonb)) s WHERE s->>'orderId'=oid::text));
END $$;
REVOKE EXECUTE ON FUNCTION public.driver_can_upload_proof_file(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_can_upload_proof_file(text) TO authenticated,service_role;
DROP POLICY delivery_proof_files_insert ON storage.objects;
CREATE POLICY delivery_proof_files_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='delivery-proofs' AND public.driver_can_upload_proof_file(name));

CREATE OR REPLACE FUNCTION public.delivery_proofs_paths_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE base text; p text;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Delivery evidence cannot be replaced'; END IF;
 base:=NEW.driver_id::text||'/'||NEW.order_id::text||'/'||NEW.id::text||'/';
 FOREACH p IN ARRAY COALESCE(NEW.photo_paths,'{}'::text[]) LOOP
  IF p IS NULL OR p !~ ('^'||base||'photo-[1-9][0-9]*\.jpg$') THEN RAISE EXCEPTION 'Photo must belong to this driver, order and proof'; END IF;
 END LOOP;
 IF NEW.signature_path IS NOT NULL AND NEW.signature_path<>base||'signature.png' THEN RAISE EXCEPTION 'Signature must belong to this driver, order and proof'; END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.delivery_proofs_paths_guard() FROM PUBLIC,anon;
CREATE TRIGGER delivery_proofs_paths_guard BEFORE INSERT OR UPDATE ON public.delivery_proofs FOR EACH ROW EXECUTE FUNCTION public.delivery_proofs_paths_guard();