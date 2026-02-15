

# Allow Route Planners Full "Send All Timeslots" Functionality

## Problem
When a route planner clicks "Send All Timeslots", the flow fails at two points:
1. **Database UPDATE blocked** -- the orders UPDATE RLS policies don't grant `route_planner` permission, so saving timeslots, scheduled dates, and status changes silently fails.
2. **Route report blocked** -- the `send-route-report` Edge Function uses `requireAdminAuth`, which rejects non-admin users with a 403 error.

The `send-timeslot-whatsapp` function has no auth check, so WhatsApp/Shipday/email notifications already work.

## Changes Required

### 1. Add a new shared auth helper: `requireAdminOrRoutePlannerAuth`

**File:** `supabase/functions/_shared/auth.ts`

Add a new function that accepts either `admin` or `route_planner` roles. This follows the existing pattern and keeps `requireAdminAuth` unchanged for other functions.

```typescript
export async function requireAdminOrRoutePlannerAuth(req: Request): Promise<AuthResult> {
  // Validate JWT token
  // Check has_role for 'admin' OR 'route_planner'
  // Return success with appropriate authType
}
```

### 2. Update `send-route-report` Edge Function

**File:** `supabase/functions/send-route-report/index.ts`

Replace the import and usage of `requireAdminAuth` with `requireAdminOrRoutePlannerAuth`, so route planners can trigger the summary report email.

### 3. Add orders UPDATE RLS policy for route planners

**Database migration**

Add a new UPDATE policy on the `orders` table granting `route_planner` users permission to update scheduling-related fields. This is a separate policy (following the existing pattern of `orders_loader_update_policy`):

```sql
CREATE POLICY "orders_route_planner_update_policy"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'route_planner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'route_planner')
  )
);
```

This grants full UPDATE access to route planners on the orders table (matching the same broad access that the loader role has), enabling them to set timeslots, scheduled dates, and status.

## Summary of Changes

| Change | File/Target | Purpose |
|--------|------------|---------|
| New auth helper | `_shared/auth.ts` | Reusable admin-or-route-planner check |
| Update import | `send-route-report/index.ts` | Allow route planners to send reports |
| New RLS policy | `orders` table (migration) | Allow route planners to update orders |

## What stays unchanged
- `send-timeslot-whatsapp` -- already works without auth
- `requireAdminAuth` -- untouched, still used by other admin-only functions
- Existing UPDATE policies for admins, customers, loaders, and public availability

