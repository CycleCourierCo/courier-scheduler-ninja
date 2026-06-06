## Vehicle Maintenance Tracking

Add a maintenance history + reminders system to each vehicle so you can see what's been done, when, at what mileage, and what's due next.

### What you'll see

On every vehicle (in `VehicleManagement` / detail view), a new **Maintenance** tab with:

- **Status panel** — current mileage and a list of upcoming/overdue items with traffic-light badges (Green = OK, Amber = due soon, Red = overdue). Examples:
  - "Oil & filter — overdue by 1,240 mi"
  - "Front-left tyre — due in 28 days"
- **History log** — chronological list of every service done, filterable by type, with date, mileage, cost, notes, and who logged it.
- **"Log service" button** — opens a dialog to record a new maintenance event.

### Service types tracked

1. **Tyres** — per position (Front-Left, Front-Right, Rear-Left, Rear-Right, Spare). Brand, model, tread depth (optional).
2. **Oil & filter** — engine oil + oil filter (one combined entry, or separate if you prefer).
3. **Brakes** — pads & discs, per axle (Front / Rear).
4. **Other** — free-form (cambelt, air filter, MOT, generic service, etc.) with a custom name.

### Reminders (mileage AND time)

Each service type has a default interval (editable per vehicle):

| Service | Default interval |
|---|---|
| Engine oil & filter | 10,000 mi or 12 months |
| Front tyres | 20,000 mi or 36 months |
| Rear tyres | 25,000 mi or 36 months |
| Front brake pads | 25,000 mi or 24 months |
| Rear brake pads | 40,000 mi or 36 months |
| Brake discs | 50,000 mi or 48 months |
| Other | per-entry custom interval |

After logging a service, the system uses **last service date/mileage + interval** to compute next-due. Whichever threshold (miles or months) hits first triggers the warning. Amber starts at 90% of the interval, red at 100%.

### Mileage source ("Both")

Current mileage per vehicle is calculated as:

1. Sum of approved-timeslip mileage (already available via `getVehicleMileageTotals`), **plus**
2. An optional **manual odometer baseline** (e.g. when the van was acquired with 45,000 mi already on it),
3. With an optional **manual override on each service log entry** (driver/admin can type the odo reading at the time of service if they have it — otherwise we fall back to the timeslip-derived figure for that date).

### Who can use it

Admins only — same RLS pattern as `vehicles` today (admin via `has_role`). Drivers and other roles will not see the Maintenance tab.

---

## Technical details

### New DB tables (migration)

**`vehicle_maintenance_logs`** — every service event
- `id`, `vehicle_id` (fk vehicles), `service_type` (enum: `oil_filter`, `tyre`, `brake_pads`, `brake_discs`, `other`), `custom_name` (text, for `other`)
- `position` (enum nullable: `front_left`, `front_right`, `rear_left`, `rear_right`, `spare`, `front_axle`, `rear_axle`)
- `service_date` (date), `odometer_mi` (int, nullable — overrides computed mileage)
- `cost` (numeric nullable), `vendor` (text nullable), `notes` (text nullable)
- `brand`, `model`, `part_number` (text nullable — useful for tyres/parts)
- `created_by`, `created_at`, `updated_at`

**`vehicle_maintenance_intervals`** — per-vehicle override of default intervals
- `id`, `vehicle_id`, `service_type`, `position` (nullable), `custom_name` (nullable for `other`)
- `interval_miles` (int nullable), `interval_months` (int nullable)
- unique on (vehicle_id, service_type, position, custom_name)

**`vehicles`** — add one column: `odometer_baseline_mi` (int, default 0) — starting odo reading when added.

All three: standard public-schema `GRANT` block (SELECT/INSERT/UPDATE/DELETE to authenticated, ALL to service_role, no anon), RLS enabled, policies use `has_role(s.uid, 'admin')` via the project's standard `EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s ...)` pattern. `updated_at` trigger using existing `update_updated_at_column()`.

Defaults table is **not** stored in DB — defaults live in `src/constants/vehicleMaintenance.ts` and are overridden per-vehicle via `vehicle_maintenance_intervals` only when changed.

### New service file
`src/services/vehicleMaintenanceService.ts`
- `listLogs(vehicleId)`, `createLog(input)`, `updateLog(id, patch)`, `deleteLog(id)`
- `listIntervals(vehicleId)`, `upsertInterval(input)`
- `computeCurrentMileage(vehicleId)` — `odometer_baseline_mi` + sum of approved timeslip mileage (reuse pagination from `getVehicleMileageTotals`)
- `computeNextDue(logs, intervals, currentMileage, today)` — pure function returning `{ serviceType, position, lastDate, lastMiles, dueDate, dueMiles, status: 'ok'|'amber'|'red', remainingMiles, remainingDays }[]`

### New UI

`src/components/vehicles/MaintenanceTab.tsx` — Status panel + history table + filters.
`src/components/vehicles/LogServiceDialog.tsx` — Form: service type → conditional fields (position for tyres/brakes, custom name for other), date, odometer, cost, brand/model, notes.
`src/components/vehicles/MaintenanceIntervalsDialog.tsx` — Per-vehicle interval overrides.
`src/components/vehicles/MaintenanceStatusBadge.tsx` — Green/amber/red pill with miles or days remaining.

Wired into `src/pages/VehicleManagement.tsx` (or the vehicle detail view) as a new tab next to existing tabs.

### Out of scope (for now)
- Automatic email/WhatsApp reminders (only visible in-app)
- Driver-side logging
- Linking a service to a specific timeslip
- File uploads (receipts, photos)

These can be added later without schema changes (reminders) or with small additions (file column + storage bucket).
