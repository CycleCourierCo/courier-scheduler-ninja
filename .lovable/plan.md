## Goal
Add a "Bike category" step to inspections that filters the repair picker, and wire the picker into inspection issues so labour prices auto-fill from the `labour_times` catalogue at the current workshop rate.

## Why category lives on the inspection
`labour_times.bike_type` has 44 fine-grained categories (Aero Road, Endurance Road, Downhill MTB, Electric MTB Hardtail, Electric Cargo…). The order-level `bike_type` is a coarse shipping enum ("Road", "MTB", "eBike") that doesn't map 1-to-1, and the bike can arrive different from what was booked. The mechanic classifies it once at inspection start.

## 1. DB migration
- `bicycle_inspections`: add nullable `bike_type TEXT`.
- `inspection_issues`: add nullable `repair_id TEXT REFERENCES labour_times(repair_id) ON DELETE SET NULL`, plus an index on `repair_id`.
- No RLS changes — existing policies cover both columns.

## 2. Types (`src/types/inspection.ts`)
- `BicycleInspection.bike_type: string | null`
- `InspectionIssue.repair_id: string | null`

## 3. Service (`src/services/inspectionService.ts`)
- Persist `bike_type` when creating an inspection; add `updateInspectionBikeType(inspectionId, bikeType)`.
- Extend `setPrice` and issue create/update payloads to accept optional `repair_id`.
- No re-pricing of historical issues when the workshop rate changes — labour on saved issues stays as captured.

## 4. Repair picker (`src/components/inspections/RepairPicker.tsx` — new)
- shadcn `Command` + `Popover` combobox.
- Props: `bikeType?: string | null`, `onSelect({ repair_id, repair_name, labour_minutes, min_charge_gbp })`.
- Debounced search hitting existing `listLabourTimes({ bikeType, search })`.
- Result rows show: repair name, category / subcategory, minutes, computed price at current rate (via `useWorkshopSettings()` + `calculateLabourPrice`).
- Toggle inside the popover: "Show all bike types" — clears the bike-type filter for edge cases.
- Safety-critical / warranty / torque-check flags rendered as small badges next to the repair name.

## 5. Inspection UI (`src/pages/BicycleInspections.tsx`)

**Starting an inspection**
- Required "Bike category" combobox (sourced from `listFilterOptions().bikeTypes`), prefilled with the order's `bike_type` when it matches a catalogue entry exactly, otherwise blank.
- Cannot proceed to add issues until a category is chosen.

**In-progress inspection header**
- Show the selected bike category as a badge with a "Change" action (admin + mechanic).
- Changing it does not rewrite existing issues; new issues use the new category filter.

**Adding / editing an issue**
- New `<RepairPicker>` above the description/parts/labour fields, pre-filtered by the inspection's `bike_type`.
- On select:
  - Set `labour_cost` = `calculateLabourPrice(labour_minutes, hourlyRate, minCharge)` (formula unchanged: `max(minCharge, ceil((minutes * rate/60)/5) * 5)`).
  - Prefill description with the repair name if description is empty.
  - Store `repair_id` on the issue.
  - Leave `parts_cost` alone (parts vary too much to auto-price).
- Show a small badge under priced issues: "From catalogue · <repair_name>" with a "Recompute at current rate" action (admin only) that re-runs the formula against the stored `repair_id`'s `labour_minutes`.
- Manual override always allowed — editing the labour field just detaches the auto-computed value (badge stays for traceability).

## 6. Permissions
- Mechanics: can set/change the inspection `bike_type`, pick repairs, add/edit issues (as today).
- Admin-only: "Recompute at current rate", and any UI that shows the workshop hourly rate/settings (unchanged from the previous mechanic-permissions pass).

## Out of scope
- No bulk re-pricing of existing issues when the workshop rate changes.
- No changes to parts pricing, workshop settings, labour_times admin, or RLS.
- No mapping table between order `bike_type` and catalogue `bike_type` — best-effort exact-match prefill only.

## Alternatives considered (rejected)
- **Reuse order.bike_type directly** — categories don't line up; would hide 40+ valid options.
- **Pick bike type per issue** — repetitive; a mechanic inspects one bike per session.
- **Auto-derive labour on read from `repair_id` + current rate (no stored labour_cost)** — breaks audit trail and invoice history.
- **Maintain an order→catalogue mapping table** — brittle (44 destination values, marketing renames) and still needs a mechanic override.
