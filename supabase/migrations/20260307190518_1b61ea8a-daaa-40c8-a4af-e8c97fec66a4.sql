-- Create notice_bars table
CREATE TABLE public.notice_bars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

-- Enable RLS
ALTER TABLE public.notice_bars ENABLE ROW LEVEL SECURITY;

-- Anon + authenticated can SELECT active notices
CREATE POLICY "notice_bars_public_select_policy"
ON public.notice_bars
FOR SELECT
TO anon, authenticated
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Admins can SELECT all notices (including inactive)
CREATE POLICY "notice_bars_admin_select_policy"
ON public.notice_bars
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin'::user_role)
));

-- Admin INSERT
CREATE POLICY "notice_bars_admin_insert_policy"
ON public.notice_bars
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin'::user_role)
));

-- Admin UPDATE
CREATE POLICY "notice_bars_admin_update_policy"
ON public.notice_bars
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin'::user_role)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin'::user_role)
));

-- Admin DELETE
CREATE POLICY "notice_bars_admin_delete_policy"
ON public.notice_bars
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin'::user_role)
));

-- Updated_at trigger
CREATE TRIGGER update_notice_bars_updated_at
  BEFORE UPDATE ON public.notice_bars
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();