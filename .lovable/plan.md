## Root cause

Sami has the `mechanic` role correctly assigned, and the `BicycleInspections` page does call `getPendingInspections()` for mechanics. That helper reads from `public.orders` filtered by `needs_inspection = true`.

The `bicycle_inspections` / `inspection_issues` RLS policies already include `mechanic`, but the **`orders` SELECT policy does not**:

```
orders_authenticated_select_policy:
  has_role(uid,'admin') OR has_role(uid,'route_planner') OR has_role(uid,'loader') OR orders.user_id = uid
```

With no `mechanic` branch, RLS returns zero order rows for Sami, so the inspections list is always empty → "No bikes requiring inspection".

## Fix

Single migration to extend the existing `orders` SELECT policy to include the mechanic role. Same standardized `EXISTS (SELECT auth.uid() AS uid)` performance pattern already used on the table:

```sql
DROP POLICY IF EXISTS orders_authenticated_select_policy ON public.orders;

CREATE POLICY orders_authenticated_select_policy
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
       OR has_role(s.uid, 'route_planner'::user_role)
       OR has_role(s.uid, 'loader'::user_role)
       OR has_role(s.uid, 'mechanic'::user_role)
       OR orders.user_id = s.uid
  )
);
```

Scope of access stays minimal: mechanics get SELECT only (no INSERT/UPDATE/DELETE), matching their existing inspection workflow which only needs to read order context (tracking #, bike, sender/receiver name) for inspections they already work on.

## Out of scope

- No UI/copy changes. The "My Inspections" header for non-admin will be revisited separately if you want it to read "Bicycle Inspections" for mechanics too.
- No other RLS tables touched.