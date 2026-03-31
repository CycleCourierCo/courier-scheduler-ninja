

## Remove Status Restrictions from Orders UPDATE RLS Policy

### Problem
The "Orders UPDATE for users and availability" policy restricts non-admin users to only updating orders in specific statuses (`sender_availability_pending`, `receiver_availability_pending`, etc.). This blocks legitimate availability updates.

### Solution
Replace the policy with a simplified version that:
- Admins: can update any order (unchanged)
- Order owner (`auth.uid() = user_id`): can update their own orders regardless of status
- Any authenticated user: can update any order (for availability flows where the sender/receiver isn't the order owner)
- Anonymous users: can update orders where availability hasn't been confirmed yet (no status check)

### Migration SQL

```sql
DROP POLICY IF EXISTS "Orders UPDATE for users and availability" ON public.orders;

CREATE POLICY "Orders UPDATE for users and availability"
ON public.orders
FOR UPDATE
USING (
  (get_user_role(auth.uid()) = 'admin'::user_role)
  OR (auth.uid() = user_id)
  OR (auth.uid() IS NOT NULL)
  OR (auth.uid() IS NULL AND (sender_confirmed_at IS NULL OR receiver_confirmed_at IS NULL))
)
WITH CHECK (
  (get_user_role(auth.uid()) = 'admin'::user_role)
  OR (auth.uid() = user_id)
  OR (auth.uid() IS NOT NULL)
  OR (auth.uid() IS NULL AND (sender_confirmed_at IS NULL OR receiver_confirmed_at IS NULL))
);
```

Note: `auth.uid() IS NOT NULL` (any authenticated user) effectively makes the owner check redundant, but keeping both for clarity. The anonymous branch retains the `confirmed_at` guard to prevent unauthenticated writes on already-confirmed orders.

### Files changed
- One new migration file only (no application code changes needed)

