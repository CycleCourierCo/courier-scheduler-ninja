CREATE TABLE public.lost_found_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.orders(id),
 item_name text NOT NULL CHECK (length(btrim(item_name)) BETWEEN 1 AND 200),
 description text NOT NULL DEFAULT '',
 item_type text NOT NULL DEFAULT 'lost' CHECK (item_type IN ('lost','found')),
 photo_path text,
 collection_van_checked boolean NOT NULL DEFAULT false,
 delivery_van_checked boolean NOT NULL DEFAULT false,
 depot_checked boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.lost_found_items TO authenticated;
GRANT ALL ON public.lost_found_items TO service_role;
ALTER TABLE public.lost_found_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY lost_found_team_select ON public.lost_found_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.has_role(s.uid,'admin') OR public.has_role(s.uid,'cs_agent')));
CREATE POLICY lost_found_team_insert ON public.lost_found_items FOR INSERT TO authenticated WITH CHECK (created_by = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.has_role(s.uid,'admin') OR public.has_role(s.uid,'cs_agent')));
CREATE POLICY lost_found_team_update ON public.lost_found_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.has_role(s.uid,'admin') OR public.has_role(s.uid,'cs_agent'))) WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.has_role(s.uid,'admin') OR public.has_role(s.uid,'cs_agent')));
CREATE INDEX lost_found_items_order_idx ON public.lost_found_items(order_id);
CREATE INDEX lost_found_items_created_idx ON public.lost_found_items(created_at DESC);
CREATE FUNCTION public.guard_lost_found_item() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
 IF TG_OP = 'UPDATE' THEN NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; NEW.id := OLD.id; END IF;
 IF NEW.photo_path IS NOT NULL AND NEW.photo_path NOT LIKE NEW.id::text || '/%' THEN RAISE EXCEPTION 'Photo must belong to this item'; END IF;
 NEW.updated_at := now(); RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.guard_lost_found_item() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guard_lost_found_item() TO authenticated, service_role;
CREATE TRIGGER guard_lost_found_item BEFORE INSERT OR UPDATE ON public.lost_found_items FOR EACH ROW EXECUTE FUNCTION public.guard_lost_found_item();
CREATE POLICY lost_found_photo_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='lost-found-photos' AND EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.has_role(s.uid,'admin') OR public.has_role(s.uid,'cs_agent')));
CREATE POLICY lost_found_photo_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='lost-found-photos' AND EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.has_role(s.uid,'admin') OR public.has_role(s.uid,'cs_agent')) AND EXISTS (SELECT 1 FROM public.lost_found_items i WHERE i.id::text = (storage.foldername(name))[1]));
CREATE POLICY lost_found_photo_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='lost-found-photos' AND EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.has_role(s.uid,'admin') OR public.has_role(s.uid,'cs_agent')));
INSERT INTO public.role_route_permissions(role,route_key,allowed) VALUES ('cs_agent','lost_found',true),('admin','lost_found',true) ON CONFLICT (role,route_key) DO UPDATE SET allowed=EXCLUDED.allowed;