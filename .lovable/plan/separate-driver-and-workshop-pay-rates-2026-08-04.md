# Separate driver and workshop pay rates

Today a person has one pay rate (`profiles.hourly_rate`). If someone is both a driver and a mechanic, the same rate is used for driving shifts and workshop shifts. This adds a second, workshop-specific rate and shows both tabs for dual-role users.

## What changes for you

- **Edit User dialog**: a user who is both driver and mechanic now sees **two tabs** — "Driver" (Shipday ID, van allowance, own-van, driver rate) and "Pay" (workshop hourly rate). Driver-only users see just "Driver"; mechanic-only users see just "Pay".
- **Driver rate** stays where it is (`hourly_rate`), used by driver timeslips.
- **Workshop rate** is a new field, used by mechanic clock-in and mechanic timeslips. If it is blank, the system falls back to the driver rate, then to £11/hr, so nothing breaks for existing staff.
- **Mechanic Clock page** shows the workshop rate; the mechanic timeslips tab still lets an admin override the rate per shift.

## Technical details

1. Migration: add `workshop_hourly_rate numeric` (nullable) to `public.profiles`.
2. `src/types/user.ts`: add `workshop_hourly_rate` to the profile type.
3. `src/components/user-management/EditUserDialog.tsx`:
   - Keep `isDriver` / `isMechanic`; render the Driver tab when `isDriver` and the Pay tab when `isMechanic` (both when dual-role).
   - Driver tab: existing fields, `hourly_rate` labelled "Driver Hourly Rate (£)".
   - Pay tab: `workshop_hourly_rate` labelled "Workshop Hourly Rate (£)" with helper text about the driver-rate fallback.
   - `TabsList` column count computed from the number of visible tabs (`grid-cols-2 sm:grid-cols-5` max) so mobile does not squash.
   - Include `workshop_hourly_rate` in the payload sent to `update_user_profile_for_management`.
4. `src/pages/MechanicClock.tsx`: rate resolution becomes `workshop_hourly_rate ?? hourly_rate ?? 11` for both the displayed rate and the value written on clock-in.
5. `src/components/timeslips/CreateTimeslipDialog.tsx` / `MechanicTimeslipsTab.tsx`: when prefilling a mechanic shift rate, use the same fallback chain. Driver timeslip creation is untouched.
6. `src/services/mechanicTimeslipService.ts`: extend the joined profile select to include `workshop_hourly_rate` so lists can show the expected rate.

Existing timeslips are unaffected — each row already stores the rate it was created with.
