
-- bicycle_inspections: add mechanic to SELECT, INSERT, UPDATE
DROP POLICY IF EXISTS bicycle_inspections_select_policy ON public.bicycle_inspections;
DROP POLICY IF EXISTS bicycle_inspections_insert_policy ON public.bicycle_inspections;
DROP POLICY IF EXISTS bicycle_inspections_update_policy ON public.bicycle_inspections;

CREATE POLICY bicycle_inspections_select_policy
ON public.bicycle_inspections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
       OR has_role(s.uid, 'mechanic'::user_role)
       OR EXISTS (
         SELECT 1 FROM orders
         WHERE orders.id = bicycle_inspections.order_id
           AND orders.user_id = s.uid
       )
  )
);

CREATE POLICY bicycle_inspections_insert_policy
ON public.bicycle_inspections
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
       OR has_role(s.uid, 'mechanic'::user_role)
  )
);

CREATE POLICY bicycle_inspections_update_policy
ON public.bicycle_inspections
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
       OR has_role(s.uid, 'mechanic'::user_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
       OR has_role(s.uid, 'mechanic'::user_role)
  )
);

-- inspection_issues: add mechanic to SELECT, INSERT; keep customer for UPDATE (approve/decline)
DROP POLICY IF EXISTS inspection_issues_select_policy ON public.inspection_issues;
DROP POLICY IF EXISTS inspection_issues_insert_policy ON public.inspection_issues;
DROP POLICY IF EXISTS inspection_issues_update_policy ON public.inspection_issues;

CREATE POLICY inspection_issues_select_policy
ON public.inspection_issues
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
       OR has_role(s.uid, 'mechanic'::user_role)
       OR EXISTS (
         SELECT 1 FROM orders
         WHERE orders.id = inspection_issues.order_id
           AND orders.user_id = s.uid
       )
  )
);

CREATE POLICY inspection_issues_insert_policy
ON public.inspection_issues
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
       OR has_role(s.uid, 'mechanic'::user_role)
  )
);

CREATE POLICY inspection_issues_update_policy
ON public.inspection_issues
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
       OR has_role(s.uid, 'mechanic'::user_role)
       OR EXISTS (
         SELECT 1 FROM orders
         WHERE orders.id = inspection_issues.order_id
           AND orders.user_id = s.uid
       )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
       OR has_role(s.uid, 'mechanic'::user_role)
       OR EXISTS (
         SELECT 1 FROM orders
         WHERE orders.id = inspection_issues.order_id
           AND orders.user_id = s.uid
       )
  )
);
