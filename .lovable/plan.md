# Fix timeslip driver lookup to respect multi-role users

## Root cause
`generate-timeslips` filters candidate drivers with `.eq('role', 'driver')` on `profiles`. Since the app moved to `user_roles`, users like Yaser whose primary `profiles.role` is `loader` (but who also have the `driver` role in `user_roles`) are filtered out and reported as "Driver not found". Yaser also has `shipday_driver_name = NULL`, so the shipday-name match can't rescue him either.

## Fix

**`supabase/functions/generate-timeslips/index.ts`** (driver lookup block, ~lines 161-194)

Replace both `.eq('role', 'driver')` filters with a `user_roles`-based restriction so anyone assigned the driver role qualifies, regardless of primary `profiles.role`:

1. Fetch the set of driver user_ids once, before the driver loop:
   ```ts
   const { data: driverRoleRows } = await supabaseClient
     .from('user_roles')
     .select('user_id')
     .eq('role', 'driver');
   const driverIds = (driverRoleRows ?? []).map(r => r.user_id);
   ```
2. Change the two profile lookups to use `.in('id', driverIds)` instead of `.eq('role', 'driver')`. Everything else (ilike on `shipday_driver_name`, ilike on `name`, fallback order) stays as-is.

No schema change, no policy change, no other files affected.

## Follow-up (data, not code)
`shipday_driver_name` is NULL on Yaser's profile. After the fix he'll match by `name ILIKE '%Yas%'`, but for reliability the user should set his `shipday_driver_name` to the exact Shipday label ("Yas") in User Management. Not part of this code change.
