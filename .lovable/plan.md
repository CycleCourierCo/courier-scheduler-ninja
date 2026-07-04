## Mechanic Timeslips + Mechanic Profitability

### 1. Mechanic clock in / clock out

**New table `mechanic_timeslips`** (schema, RLS, GRANTs):
- `driver_id` → mechanic user id (reused naming for consistency)
- `date` (Europe/London), `clock_in_at`, `clock_out_at` timestamps
- `clock_in_photo_url`, `clock_out_photo_url` (Supabase Storage, private bucket `mechanic-clock-photos`)
- `clock_in_lat/lng`, `clock_out_lat/lng`
- `hourly_rate` (snapshot from profile), `lunch_hours` (default 0.5), `total_hours` and `total_pay` generated columns
- `status` (`open` | `closed` | `approved` | `rejected`), `admin_notes`, `approved_by`, `approved_at`
- RLS: mechanic can insert/read/update their own open slip; admins/`timeslip_admin` can read/update all; storage policy scoped to `driver_id/` prefix

**New Storage bucket** `mechanic-clock-photos` (private, RLS scoped by folder = user id).

**New page `/mechanic-clock`** (mechanic role, added to sidebar under Timeslips):
- Big **Clock In** button when no open slip today → opens camera (`<input type="file" accept="image/*" capture="environment">`), requests `navigator.geolocation.getCurrentPosition`, uploads photo, inserts row with server `now()`.
- If open slip exists → shows live elapsed time + **Clock Out** button (same photo + GPS flow), closes the slip.
- History list of the mechanic's own past slips with status.

**Admin section in existing Timeslips page**:
- New tab **"Mechanic Timeslips"** listing all `mechanic_timeslips` with filters (driver, status, date range). Row shows both photos (thumbnails → lightbox), GPS pins on a small map link, hours, pay. Approve / reject actions and edit dialog (rate, lunch, notes).

### 2. Mechanic Profitability panel (bottom of Route Profitability page)

New section rendered under existing route profitability, admin-only, with the same date-range filter.

**Revenue per mechanic**, aggregated in one service (`mechanicProfitabilityService.ts`):

- **Inspection revenue (£60 each)** — for every `bicycle_inspections` row where `status` transitioned from `awaiting_inspection` to either `awaiting_pricing` (issues found) or straight to `no_issues`/`released_to_customer_at` with no open issues, within the date range. Attribute £60 to `inspected_by_id` on the transition date. Source of transition date = `inspected_at` (fallback `updated_at`).
- **Repair revenue (labour = price − part cost)** — for every `inspection_issues` row where `status IN ('resolved','repaired')` and `resolved_at` is in the range. Amount = `COALESCE(price,0) − COALESCE(part_cost,0)` (never below 0). Attribute to `resolved_by_id`.

**Cost per mechanic** — sum of `total_pay` from `mechanic_timeslips` where `date` is in the range and status ∈ (`closed`,`approved`).

**Table columns**: Mechanic · Inspections done · Inspection revenue · Repairs done · Repair revenue · **Total revenue** · Hours worked · Wage cost · **Profit** · Profit margin %.

Grand total row at the bottom.

### Technical details

- **Files added**: `supabase/migrations/*` (table + bucket policies), `src/services/mechanicTimeslipService.ts`, `src/services/mechanicProfitabilityService.ts`, `src/pages/MechanicClock.tsx`, `src/components/timeslips/MechanicTimeslipList.tsx`, `src/components/timeslips/MechanicTimeslipEditDialog.tsx`, `src/components/analytics/MechanicProfitabilityPanel.tsx`.
- **Files edited**: `src/App.tsx` (route), `src/components/Layout.tsx` (sidebar link for mechanic + admin tab), `src/pages/DriverTimeslips.tsx` (add "Mechanic" tab), `src/pages/RouteProfitabilityPage.tsx` (mount the new panel at the bottom).
- Photo upload = `supabase.storage.from('mechanic-clock-photos').upload(\`${uid}/${slipId}-in.jpg\`, blob)`.
- GPS captured with `navigator.geolocation`; if user denies, we still allow submit but flag the row `location_missing = true` for admin visibility.
- Timezone: `date` computed with `Europe/London` (matches existing driver timeslip convention).
- No changes to driver timeslip logic or route profitability numbers above.

### Out of scope
- Enforcing a geo-fence radius (photo + GPS captured, not validated against a workshop location).
- QuickBooks bill creation for mechanic timeslips (can be added later, matching driver flow).
- Historical backfill of inspection/repair revenue before this ships (calculations are date-range based and will just work from existing timestamps).
