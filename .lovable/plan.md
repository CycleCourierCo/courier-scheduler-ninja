## Why drivers don't show up for Sulayman

The Loading & Unloading page loads drivers and loaders with:

```ts
supabase.from('profiles').select('id, name, phone, email').eq('role', 'driver').eq('is_active', true)
```

The `profiles` SELECT policy currently allows: own row, or admin/sales only. A loader like Sulayman is neither admin nor sales, so this query returns just his own profile — so the driver list is empty and the loader list shows only himself. That is why the driver picker is blank.

## Fix

### 1. Database: let internal staff read driver/loader profiles

Add a new RLS SELECT policy on `public.profiles` that allows any internal staff user (admin, cs_agent, route_planner, loader, driver, sales, timeslip_admin, mechanic — i.e. the existing `is_internal_staff(auth.uid())` helper) to read profile rows that belong to drivers or loaders.

- Keeps existing self-read and admin/sales policies untouched.
- Does NOT expose customer profiles.
- Only exposes `driver` and `loader` operational profiles needed to send loading lists.

### 2. No frontend change required

After the policy is added, the existing `LoadingUnloadingPage` driver and loader selectors will populate for loaders like Sulayman with no code change.

### 3. Verify

After approving the migration, Sulayman reopens the loading list dialog — drivers and loaders appear and loading lists can be sent normally.