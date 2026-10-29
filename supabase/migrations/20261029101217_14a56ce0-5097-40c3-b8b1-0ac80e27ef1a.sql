CREATE TABLE public.delivery_proof_uploads (id uuid PRIMARY KEY, driver_id uuid NOT NULL, order_id uuid NOT NULL, captured_at timestamptz NOT NULL, photo_paths text[] NOT NULL DEFAULT '{}', signature_path text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT ON public.delivery_proof_uploads TO authenticated;
GRANT ALL ON public.delivery_proof_uploads TO service_role;
ALTER TABLE public.delivery_proof_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY proof_uploads_select ON public.delivery_proof_uploads FOR SELECT TO authenticated USING(driver_id=(SELECT auth.uid()));
CREATE POLICY proof_uploads_insert ON public.delivery_proof_uploads FOR INSERT TO authenticated WITH CHECK(driver_id=(SELECT auth.uid()) AND public.has_role((SELECT auth.uid()),'driver') AND captured_at<=now()+interval '10 minutes' AND public.driver_can_prove_order(order_id,captured_at));

CREATE OR REPLACE FUNCTION public.delivery_proofs_paths_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE base text; p text; manifest public.delivery_proof_uploads;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Delivery evidence cannot be replaced'; END IF;
 base:=NEW.driver_id::text||'/'||NEW.order_id::text||'/'||NEW.id::text||'/';
 FOREACH p IN ARRAY COALESCE(NEW.photo_paths,'{}'::text[]) LOOP
  IF p IS NULL OR p !~ ('^'||base||'photo-[1-9][0-9]*\.jpg$') THEN RAISE EXCEPTION 'Photo must belong to this driver, order and proof'; END IF;
 END LOOP;
 IF NEW.signature_path IS NOT NULL AND NEW.signature_path<>base||'signature.png' THEN RAISE EXCEPTION 'Signature must belong to this driver, order and proof'; END IF;
 IF cardinality(NEW.photo_paths)=0 AND NEW.signature_path IS NULL THEN RAISE EXCEPTION 'Delivery evidence is required'; END IF;
 IF NEW.stop_type NOT IN ('pickup','delivery') THEN RAISE EXCEPTION 'Invalid stop type'; END IF;
 IF TG_TABLE_NAME='delivery_proofs' THEN
  SELECT * INTO manifest FROM public.delivery_proof_uploads WHERE id=NEW.id;
  IF manifest.id IS NULL OR manifest.driver_id<>NEW.driver_id OR manifest.order_id<>NEW.order_id OR manifest.captured_at<>NEW.captured_at OR manifest.photo_paths IS DISTINCT FROM NEW.photo_paths OR manifest.signature_path IS DISTINCT FROM NEW.signature_path THEN RAISE EXCEPTION 'Proof does not match its upload reservation'; END IF;
 END IF;
 RETURN NEW;
END $$;
-- Reservation path validation has no stop_type, so use a dedicated guard.
CREATE OR REPLACE FUNCTION public.delivery_proof_uploads_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE base text; p text;
BEGIN
 base:=NEW.driver_id::text||'/'||NEW.order_id::text||'/'||NEW.id::text||'/';
 FOREACH p IN ARRAY NEW.photo_paths LOOP IF p IS NULL OR p !~ ('^'||base||'photo-[1-9][0-9]*\.jpg$') THEN RAISE EXCEPTION 'Invalid reserved photo path'; END IF; END LOOP;
 IF NEW.signature_path IS NOT NULL AND NEW.signature_path<>base||'signature.png' THEN RAISE EXCEPTION 'Invalid reserved signature path'; END IF;
 IF cardinality(NEW.photo_paths)=0 AND NEW.signature_path IS NULL THEN RAISE EXCEPTION 'Delivery evidence is required'; END IF;
 IF cardinality(NEW.photo_paths)<>(SELECT count(DISTINCT x) FROM unnest(NEW.photo_paths) x) THEN RAISE EXCEPTION 'Duplicate photo path'; END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.delivery_proof_uploads_guard() FROM PUBLIC,anon;
CREATE TRIGGER delivery_proof_uploads_guard BEFORE INSERT ON public.delivery_proof_uploads FOR EACH ROW EXECUTE FUNCTION public.delivery_proof_uploads_guard();
CREATE OR REPLACE FUNCTION public.driver_can_upload_proof_file(_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.delivery_proof_uploads u WHERE u.driver_id=(SELECT auth.uid()) AND (_name=ANY(u.photo_paths) OR _name=u.signature_path) AND NOT EXISTS(SELECT 1 FROM public.delivery_proofs p WHERE p.id=u.id));
$$;
REVOKE EXECUTE ON FUNCTION public.driver_can_upload_proof_file(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_can_upload_proof_file(text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.verify_foam_photo_access(p_identifier text,p_postcode text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders; pc text; recent int;
BEGIN
 IF length(trim(coalesce(p_identifier,'')))=0 OR length(p_identifier)>100 THEN RETURN jsonb_build_object('verified',false); END IF;
 pc:=public._normalise_postcode(p_postcode);
 IF coalesce(pc,'')='' OR length(pc)>20 THEN RETURN jsonb_build_object('verified',false); END IF;
 SELECT * INTO o FROM public.orders WHERE lower(id::text)=lower(trim(p_identifier)) OR lower(tracking_number)=lower(trim(p_identifier)) OR lower(customer_order_number)=lower(trim(p_identifier)) ORDER BY CASE WHEN lower(id::text)=lower(trim(p_identifier)) THEN 0 WHEN lower(tracking_number)=lower(trim(p_identifier)) THEN 1 ELSE 2 END LIMIT 1;
 IF o.id IS NULL THEN RETURN jsonb_build_object('verified',false); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('foam-proof:'||o.id::text,0));
 -- Aggregate the existing attempt ledger rather than trusting caller-supplied IP headers.
 SELECT count(*) INTO recent FROM public.tracking_postcode_attempts WHERE order_id=o.id AND attempted_at>now()-interval '10 minutes';
 IF recent>=10 THEN RETURN jsonb_build_object('verified',false,'rate_limited',true); END IF;
 INSERT INTO public.tracking_postcode_attempts(order_id,ip) VALUES(o.id,'');
 IF pc IS DISTINCT FROM public._normalise_postcode(COALESCE(o.receiver->>'postcode',o.receiver->>'zipCode',o.receiver->>'postal_code',o.receiver->'address'->>'zipCode',o.receiver->'address'->>'postcode',o.receiver->'address'->>'postal_code')) THEN RETURN jsonb_build_object('verified',false); END IF;
 RETURN jsonb_build_object('verified',true,'paths',COALESCE(o.foam_delivery_photos,'[]'::jsonb));
END $$;
REVOKE EXECUTE ON FUNCTION public.verify_foam_photo_access(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_foam_photo_access(text,text) TO service_role;