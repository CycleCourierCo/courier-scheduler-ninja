# Pay drivers per mile on timeslips

## What changes
- Each driver gets a **pay type**: Hourly (current) or Per mile, plus a **per-mile rate** (£).
- Set on the driver's profile in driver settings. New timeslips copy the driver's pay type and rate; admins can still change both on a single timeslip.
- Per-mile pay = **mileage × per-mile rate + van allowance**. Hours are still recorded (for reports) but don't affect pay.
- Hourly drivers are unchanged; all existing timeslips stay hourly with the same totals.
- Timeslip create/edit forms show a Hourly / Per mile switch; the pay breakdown shows "X miles × £Y" when per mile.
- Pay totals in driver analytics and timeslip lists use the new total automatically.

## Technical details
- Migration: `profiles.pay_type text default 'hourly'`, `profiles.per_mile_rate numeric`; `timeslips.pay_type text default 'hourly'`, `timeslips.per_mile_rate numeric`. Recreate generated `total_pay`: `CASE WHEN pay_type='per_mile' THEN COALESCE(mileage,0)*COALESCE(per_mile_rate,0) + van_allowance ELSE (current hours formula) END`. Validation trigger limits pay_type to hourly/per_mile. Extend the profile-update RPC to accept the two new fields (admin only, as hourly_rate today).
- Timeslip generation/creation copies pay_type/per_mile_rate from the driver profile.
- Update `src/types/timeslip.ts`, `timeslipService.ts`, timeslip forms, driver profile settings.
- Add `calculateTimeslipPay` helper with vitest tests: per-mile (e.g. 120 miles × £0.45 + £10 = £64) and hourly unchanged.
