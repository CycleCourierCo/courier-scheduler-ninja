

## Vehicle Management Page

A new admin page to manage the van fleet. Add a van by registration → DVLA VES API auto-populates details → store + display with status, London Auto Pay flag, and Dartford Crossing flag.

### Data model — new table `vehicles`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `registration` | text UNIQUE (uppercased) | user input |
| `status` | enum `vehicle_status` | `purchased`, `in_prep`, `in_use`, `sold`, `off_road` (default `purchased`) |
| `london_auto_pay` | boolean | default false |
| `dartford_crossing` | boolean | default false |
| `make` / `colour` / `fuel_type` / `year_of_manufacture` | text/int | from VES |
| `engine_capacity` | int | cc |
| `co2_emissions` | int | g/km |
| `tax_status` / `tax_due_date` | text / date | from VES |
| `mot_status` / `mot_expiry_date` | text / date | from VES |
| `date_of_last_v5c_issued` | date | from VES |
| `marked_for_export` / `type_approval` / `wheelplan` / `revenue_weight` / `euro_status` / `real_driving_emissions` | misc | from VES |
| `notes` | text | optional admin notes |
| `ves_raw` | jsonb | full last response (debug / future fields) |
| `last_refreshed_at` | timestamptz | when VES was last fetched |
| `created_by` | uuid | `auth.uid()` |
| `created_at` / `updated_at` | timestamptz | with trigger |

RLS: admin-only for all CRUD (`has_role(uid,'admin')`), following the standard performance pattern. New enum `vehicle_status`.

### DVLA VES integration

VES requires an API key in header `x-api-key`, POST to `https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles` with `{ "registrationNumber": "ABC123" }`.

- New secret: `DVLA_VES_API_KEY` (request from user before deploying).
- New edge function `lookup-vehicle` (admin-only via JWT + `has_role` check):
  - Input: `{ registration }`
  - Validates/normalises registration (strip spaces, uppercase, basic UK regex).
  - Calls VES, returns mapped fields + raw payload.
  - Handles 404 (not found) and 400 (bad reg) with clean errors.
- Used by both "Add vehicle" and a per-row "Refresh from DVLA" button.

### Pages & components

- `src/pages/VehicleManagement.tsx` — wrapped in `Layout` + `ProtectedRoute` (admin only), route `/vehicles`. Table of all vans with: reg, make, colour, status badge, tax status + due, MOT status + expiry, London Auto Pay ✓, Dartford ✓, last refreshed, actions (Edit, Refresh, Delete).
- `src/components/vehicles/AddVehicleDialog.tsx` — input registration → calls `lookup-vehicle` → preview fetched details → toggles for London Auto Pay / Dartford Crossing → status select → Save (insert into `vehicles`).
- `src/components/vehicles/EditVehicleDialog.tsx` — edit status, the two toggles, notes; "Refresh from DVLA" re-runs lookup and updates DVLA-sourced fields + `last_refreshed_at`.
- `src/components/vehicles/VehicleStatusBadge.tsx` — colour-coded badge for the 5 statuses.
- `src/services/vehicleService.ts` — CRUD helpers + `invoke('lookup-vehicle')` wrapper.
- Sidebar nav: add "Vehicles" entry (admin-only), icon `Truck`.
- `App.tsx`: register `/vehicles` route.

### UX details

- Tax/MOT expiry highlighted amber if within 30 days, red if expired.
- Status filter + search by reg.
- After Add, row appears immediately with `last_refreshed_at = now()`.
- Mobile: cards instead of table (matches existing patterns).

### Files

**New**
- migration: `vehicle_status` enum + `vehicles` table + RLS + `update_updated_at` trigger.
- `supabase/functions/lookup-vehicle/index.ts` (+ admin auth check, CORS, Zod validation).
- `src/pages/VehicleManagement.tsx`
- `src/components/vehicles/AddVehicleDialog.tsx`
- `src/components/vehicles/EditVehicleDialog.tsx`
- `src/components/vehicles/VehicleStatusBadge.tsx`
- `src/services/vehicleService.ts`

**Modified**
- `src/App.tsx` — new route.
- Sidebar component (admin nav) — new "Vehicles" link.

### Pre-implementation step

Request `DVLA_VES_API_KEY` secret. Sign up at the DVLA developer portal (link in your message), create an application for the Vehicle Enquiry Service, copy the API key, paste into the secret prompt. Nothing else is needed from your side.

### Verification

- Add reg `AA19AAA` (or any real van reg) → preview shows make/colour/tax/MOT → save → row appears.
- Toggle London Auto Pay / Dartford on the row → persists.
- Change status to `in_prep` → badge updates.
- Click Refresh on an existing row → `last_refreshed_at` updates, MOT/tax fields refresh.
- Non-admin user navigating to `/vehicles` → redirected (ProtectedRoute).

