
-- 1. Replace orders INSERT policy: use has_role (user_roles) instead of get_user_role (profiles.role)
DROP POLICY IF EXISTS "Consolidated orders INSERT policy" ON public.orders;
CREATE POLICY "Consolidated orders INSERT policy"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::user_role)
  OR (
    auth.uid() = user_id
    AND (
      public.has_role(auth.uid(), 'b2b_customer'::user_role)
      OR public.has_role(auth.uid(), 'b2c_customer'::user_role)
      OR public.has_role(auth.uid(), 'sales'::user_role)
      OR public.has_role(auth.uid(), 'cs_agent'::user_role)
      OR public.has_role(auth.uid(), 'route_planner'::user_role)
    )
  )
);

-- 2. Prevent users from self-promoting via profiles.role / account_status update.
--    Replace the consolidated UPDATE policy with a self-update that cannot
--    change role or account_status (admins/sales bypass via separate clause).
DROP POLICY IF EXISTS "Consolidated profiles UPDATE policy" ON public.profiles;

CREATE POLICY "Profiles self update (no role escalation)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND account_status IS NOT DISTINCT FROM (SELECT p.account_status FROM public.profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "Profiles admin/sales update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin_or_sales())
WITH CHECK (public.is_admin_or_sales());

-- 3. Realtime: restrict channel subscriptions to authenticated users.
--    Source-table RLS still filters which rows postgres_changes delivers,
--    but this denies anonymous Realtime access entirely.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='realtime' AND c.relname='messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';

    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    EXECUTE $p$
      CREATE POLICY "Authenticated can receive realtime"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (true)
    $p$;
  END IF;
END $$;

-- 4. Defence-in-depth: explicit anon INSERT policy for the postcode rate limiter.
--    The RPC is SECURITY DEFINER so this is belt-and-braces.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tracking_postcode_attempts'
      AND policyname='Rate limiter insert (anon)'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Rate limiter insert (anon)"
      ON public.tracking_postcode_attempts
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true)
    $p$;
  END IF;
END $$;

GRANT INSERT ON public.tracking_postcode_attempts TO anon, authenticated;
