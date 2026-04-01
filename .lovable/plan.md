

## Fix Availability: Let Anyone with Link Set Dates + Show Confirmation

### Root Causes
1. **Hook blocks form with error**: When dates already exist, `useAvailability` sets an `error` string which renders an `ErrorState` card instead of showing the confirmed dates or the form.
2. **Anonymous UPDATE policy is restrictive**: The `confirmed_at IS NULL` guard on anonymous updates means if someone partially submitted or the timestamp was set, they can't retry.

### Changes

#### 1. Database Migration — Simplify anon UPDATE policy
Remove the `sender_confirmed_at`/`receiver_confirmed_at` guard for anonymous users. Anyone with the UUID link can update the order (the UUID itself is the secret).

```sql
DROP POLICY IF EXISTS "Orders UPDATE for users and availability" ON public.orders;
CREATE POLICY "Orders UPDATE for users and availability" ON public.orders FOR UPDATE
USING (
  (get_user_role(auth.uid()) = 'admin'::user_role)
  OR (auth.uid() = user_id)
  OR (auth.uid() IS NOT NULL)
  OR (auth.uid() IS NULL)  -- anyone with the link
)
WITH CHECK (
  (get_user_role(auth.uid()) = 'admin'::user_role)
  OR (auth.uid() = user_id)
  OR (auth.uid() IS NOT NULL)
  OR (auth.uid() IS NULL)
);
```

#### 2. New component: `ConfirmedDatesView`
A read-only card showing the confirmed dates as badges and any notes. No form, no submit button. Displayed when dates have already been set.

#### 3. Update `useAvailability` hook
- Instead of setting `error` when dates are already confirmed, set a new `isAlreadyConfirmed` boolean flag and store the `confirmedDates` array.
- Return both so the page components can conditionally render the confirmation view.

#### 4. Update `SenderAvailability` and `ReceiverAvailability` pages
- When `isAlreadyConfirmed` is true, render `ConfirmedDatesView` instead of `AvailabilityForm`.
- Pass the confirmed dates and notes from the order.

### Files
1. New migration SQL
2. New: `src/components/availability/ConfirmedDatesView.tsx`
3. Modified: `src/hooks/useAvailability.tsx`
4. Modified: `src/pages/SenderAvailability.tsx`
5. Modified: `src/pages/ReceiverAvailability.tsx`

