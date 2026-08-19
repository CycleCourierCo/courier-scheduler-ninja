CREATE POLICY "Admins can read driver licence files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'driver-licences' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'timeslip_admin')));

CREATE POLICY "Admins can upload driver licence files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'driver-licences' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'timeslip_admin')));

CREATE POLICY "Admins can update driver licence files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'driver-licences' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'timeslip_admin')))
WITH CHECK (bucket_id = 'driver-licences' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'timeslip_admin')));

CREATE POLICY "Admins can delete driver licence files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'driver-licences' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'timeslip_admin')));