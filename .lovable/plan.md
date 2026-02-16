

# Fix: Loaders Cannot See Bikes or Generate Labels on Loading Page

## Root Cause

The current `orders_authenticated_select_policy` on the `orders` table only grants SELECT access to:
- `admin`
- `route_planner`
- The order owner (`user_id`)

The `loader` role is missing from this policy. Since all data on the Loading/Storage page comes from querying the `orders` table, loaders see an empty page and cannot generate collection labels.

## Solution

Update the `orders_authenticated_select_policy` to also include the `loader` role.

### Database Migration

```sql
DROP POLICY IF EXISTS "orders_authenticated_select_policy" ON public.orders;

CREATE POLICY "orders_authenticated_select_policy"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin')
       OR public.has_role(s.uid, 'route_planner')
       OR public.has_role(s.uid, 'loader')
       OR orders.user_id = s.uid
  )
);
```

This is a single migration that adds `OR public.has_role(s.uid, 'loader')` to the existing SELECT policy. No frontend changes are needed -- the loading page code and label generation already work correctly once the loader can read order data.

## What This Fixes

| Feature | Before | After |
|---------|--------|-------|
| View bikes on Loading page | Empty / no data | All orders visible |
| Pending Storage Allocation tab | Empty | Shows collected bikes |
| Bikes In Storage tab | Empty | Shows stored bikes |
| Print Collection Labels button | No orders found | Generates label PDFs |
| Storage unit layout | All bays empty | Shows occupied bays |

