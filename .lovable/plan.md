## Goal
Add a new `timeslip_admin` role that has the same timeslip permissions as `admin` (edit, approve/reject, generate, delete) but no other admin access. Restricted to the Driver Timeslips page only, similar to how `loader`/`mechanic` are scoped.

## Database

New migration:
- `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'timeslip_admin';`
- Add helper:
  ```sql
  CREATE OR REPLACE FUNCTION public.is_timeslip_admin()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT public.has_role(auth.uid(), 'admin'::user_role)
        OR public.has_role(auth.uid(), 'timeslip_admin'::user_role)
  $$;
  ```
- Update RLS policies on timeslip tables (`driver_timeslips`, `timeslip_vehicle_assignments`, and any related timeslip tables defined in `20251026205248_*.sql` and `20260209030030_*.sql`) to replace `has_role(auth.uid(), 'admin')` with `public.is_timeslip_admin()` for ALL operations (SELECT/INSERT/UPDATE/DELETE). Existing admin behaviour is preserved because the helper still returns true for admins.
- No grants needed beyond what those tables already have (authenticated).

## Frontend

`src/types/user.ts` — add `'timeslip_admin'` to `UserRole`.

`src/lib/roles.ts` — add `{ value: "timeslip_admin", label: "Timeslip Admin" }` to `ALL_ROLES`.

`src/pages/DriverTimeslips.tsx` — change:
```ts
const isAdmin = userProfile?.role === 'admin';
```
to:
```ts
const isAdmin = hasRole(userProfile, 'admin') || hasRole(userProfile, 'timeslip_admin');
```
(import `hasRole` from `@/lib/roles`). All existing admin-gated UI (edit, approve/reject, generate, delete, QuickBooks bills, bulk vehicle assignment) becomes available to the new role automatically.

`src/components/Layout.tsx` — treat `timeslip_admin` like `loader`/`mechanic`: suppress general nav and show a Timeslips nav link so they land directly on `/driver-timeslips`. Also add redirect logic (mirroring loader handling) so the role can't access unrelated pages.

## Out of scope
- No changes to QuickBooks bill creation logic itself (the role inherits via the same isAdmin gate, which the user explicitly excluded — they only chose Edit, Approve/Reject, Generate & Delete). To honour that, the QuickBooks bills button in `DriverTimeslips.tsx` will be gated on `userProfile?.role === 'admin'` (true admin only), while the new `isAdmin` flag drives the other controls.

## Verification
- Assign the new role to a test profile via Supabase users page.
- Confirm sign-in lands on `/driver-timeslips`, edit/approve/generate/delete work, QuickBooks bill button is hidden, and other admin pages return unauthorised.
