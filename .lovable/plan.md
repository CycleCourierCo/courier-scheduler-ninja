## Goal
Let admins set a default vehicle per driver, and have new/generated timeslips auto-assign that vehicle.

## Changes

**1. Database (migration)**
- Add `default_vehicle_id uuid` to `public.profiles` (nullable, no FK to keep flexible with existing pattern on `timeslips.vehicle_id`).

**2. Driver Management UI** (`src/components/timeslips/DriverManagementDialog.tsx`)
- Add a "Default vehicle" `Select` per driver (list from `vehicleService.getVehicles()`), with "None" option.
- Save via existing driver update path.

**3. Timeslip generation** (`supabase/functions/generate-timeslips/index.ts`)
- When upserting a timeslip, include `vehicle_id: driver.default_vehicle_id ?? null` (only set on insert — don't overwrite if a timeslip already has a vehicle assigned). Simplest: include in upsert payload; if drivers' default changes later, regenerated drafts will pick it up.

**4. Manual timeslip creation paths**
- `TimeslipEditDialog.tsx` / any "create timeslip" flow: pre-fill `vehicle_id` from driver's `default_vehicle_id` when opening a fresh timeslip.

**5. Types**
- `src/types/timeslip.ts` (or driver/profile types) — add `default_vehicle_id` field on driver/profile shape used by the dialog.

## Out of scope
- No change to bulk-assign vehicle dialog (it's an explicit override).
- No backfill of existing timeslips.
