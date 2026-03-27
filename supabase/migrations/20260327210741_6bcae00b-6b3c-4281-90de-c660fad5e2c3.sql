
CREATE TABLE public.scheduled_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  html_body text NOT NULL,
  recipient_ids text[] DEFAULT '{}',
  recipient_roles text[] DEFAULT '{}',
  recipient_mode text NOT NULL DEFAULT 'individual',
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_message text
);

ALTER TABLE public.scheduled_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_announcements_select_policy" ON public.scheduled_announcements
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY "scheduled_announcements_insert_policy" ON public.scheduled_announcements
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY "scheduled_announcements_update_policy" ON public.scheduled_announcements
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY "scheduled_announcements_delete_policy" ON public.scheduled_announcements
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));
