## Insurance tab on Vehicle Management

Add an **Insurance** tab to the Vehicles page with policy history per vehicle, a fleet-wide Gantt timeline, and an "uninsured vehicles" panel.

### Database (new table)

`vehicle_insurance_policies`
- `vehicle_id` (uuid, FK → vehicles.id, on delete cascade)
- `insurer` (text)
- `policy_number` (text, nullable)
- `start_date` (date, required)
- `end_date` (date, required)
- `premium` (numeric, nullable)
- `notes` (text, nullable)
- standard `id`, `created_at`, `updated_at`, `created_by`

RLS: admin full access (matches existing vehicle policies). Index on `(vehicle_id, start_date)`.

### UI

`VehicleManagement.tsx` wrapped in `Tabs` with two tabs:
1. **Vehicles** — existing list/grid, unchanged.
2. **Insurance** — new view containing:
   - **Uninsured vehicles** card at top: lists all active (non-sold) vehicles where no policy covers today's date. Each row has a "Add policy" button.
   - **Coverage timeline** (Gantt): rows = vehicles, x-axis = months. Default range = 12 months from current month, with prev/next navigation. Each policy rendered as a coloured bar; hovering shows insurer + dates; clicking opens edit. Vehicles with gaps show empty space (visually flags uninsured periods).
   - **Policies table** below the chart: filterable by vehicle, sortable by end date, with Edit/Delete actions and "Expiring in 30 days" highlight.

### New components
- `src/components/vehicles/InsuranceTab.tsx` — orchestrates the tab.
- `src/components/vehicles/InsuranceTimeline.tsx` — Gantt chart (pure CSS grid, no new deps).
- `src/components/vehicles/UninsuredVehiclesCard.tsx`.
- `src/components/vehicles/PolicyDialog.tsx` — add/edit policy form (vehicle picker, insurer, policy #, start, end, premium, notes).

### Service layer
- `src/services/insuranceService.ts` — `listPolicies()`, `createPolicy()`, `updatePolicy()`, `deletePolicy()`, plus helper `getCurrentlyUninsuredVehicles(vehicles, policies)` (client-side: vehicle has no policy where `start_date <= today <= end_date`).

### Out of scope
- No automated renewal reminders / emails.
- No document upload for policy PDFs (can be added later).
- No changes to existing vehicle fields.