GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO authenticated;
GRANT ALL ON public.claims TO service_role;
GRANT SELECT, INSERT ON public.claim_notes TO authenticated;
GRANT ALL ON public.claim_notes TO service_role;
GRANT SELECT, INSERT, DELETE ON public.claim_evidence_files TO authenticated;
GRANT ALL ON public.claim_evidence_files TO service_role;
GRANT SELECT ON public.claim_status_log TO authenticated;
GRANT ALL ON public.claim_status_log TO service_role;

CREATE OR REPLACE FUNCTION public.set_claim_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS claims_set_created_by ON public.claims;
CREATE TRIGGER claims_set_created_by
BEFORE INSERT ON public.claims
FOR EACH ROW
EXECUTE FUNCTION public.set_claim_created_by();

DROP POLICY IF EXISTS claims_admin_all ON public.claims;
CREATE POLICY claims_team_select
ON public.claims
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);
CREATE POLICY claims_team_insert
ON public.claims
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);
CREATE POLICY claims_team_update
ON public.claims
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);
CREATE POLICY claims_admin_delete
ON public.claims
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
  )
);

DROP POLICY IF EXISTS claim_notes_admin_all ON public.claim_notes;
CREATE POLICY claim_notes_team_select
ON public.claim_notes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);
CREATE POLICY claim_notes_team_insert
ON public.claim_notes
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);

DROP POLICY IF EXISTS claim_evidence_admin_all ON public.claim_evidence_files;
CREATE POLICY claim_evidence_team_select
ON public.claim_evidence_files
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);
CREATE POLICY claim_evidence_team_insert
ON public.claim_evidence_files
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);
CREATE POLICY claim_evidence_team_delete
ON public.claim_evidence_files
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);

DROP POLICY IF EXISTS claim_status_log_admin_select ON public.claim_status_log;
CREATE POLICY claim_status_log_team_select
ON public.claim_status_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);

DROP POLICY IF EXISTS claim_evidence_admin_select ON storage.objects;
DROP POLICY IF EXISTS claim_evidence_admin_insert ON storage.objects;
DROP POLICY IF EXISTS claim_evidence_admin_update ON storage.objects;
DROP POLICY IF EXISTS claim_evidence_admin_delete ON storage.objects;

CREATE POLICY claim_evidence_team_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'claim-evidence'
  AND EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);
CREATE POLICY claim_evidence_team_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'claim-evidence'
  AND EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);
CREATE POLICY claim_evidence_team_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'claim-evidence'
  AND EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
)
WITH CHECK (
  bucket_id = 'claim-evidence'
  AND EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);
CREATE POLICY claim_evidence_team_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'claim-evidence'
  AND EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);