CREATE POLICY "Admins read fuel invoice files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'fuel-invoices' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins upload fuel invoice files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'fuel-invoices' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete fuel invoice files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'fuel-invoices' AND public.has_role(auth.uid(), 'admin'));