GRANT UPDATE ON public.claim_evidence_files TO authenticated;
CREATE POLICY claim_evidence_team_update
ON public.claim_evidence_files
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
  uploaded_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);