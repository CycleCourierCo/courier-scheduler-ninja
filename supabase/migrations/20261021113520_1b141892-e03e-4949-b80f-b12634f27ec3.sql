CREATE POLICY "cs staff upload attachments" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cs-attachments' AND (public.has_role((SELECT auth.uid()), 'admin'::user_role) OR public.has_role((SELECT auth.uid()), 'cs_agent'::user_role)));
CREATE POLICY "cs staff read attachments" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cs-attachments' AND (public.has_role((SELECT auth.uid()), 'admin'::user_role) OR public.has_role((SELECT auth.uid()), 'cs_agent'::user_role)));
CREATE POLICY "cs staff delete attachments" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cs-attachments' AND (public.has_role((SELECT auth.uid()), 'admin'::user_role) OR public.has_role((SELECT auth.uid()), 'cs_agent'::user_role)));