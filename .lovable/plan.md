## Changes

### 1. Remove cost field from mechanic's issue reporting
- In `src/pages/BicycleInspections.tsx` issue-reporting dialog, remove the `estimated_cost` input. Mechanic only enters description + part name/spec/number.
- `addInspectionIssue` is called with `estimatedCost: null` so the issue lands in `awaiting_pricing` for admin to price. (Service signature already supports null — no change to `inspectionService.ts` needed.)

### 2. Add "parts ordered" stage in Awaiting Parts
**DB migration** (`inspection_issues`):
- Add `parts_ordered boolean NOT NULL DEFAULT false`
- Add `parts_ordered_at timestamptz`
- Add `parts_ordered_by_id uuid`, `parts_ordered_by_name text`

**Service (`src/services/inspectionService.ts`)**:
- Add `markPartsOrdered(issueId, byId, byName)` / `unmarkPartsOrdered(issueId)` mirroring the existing parts-arrived helpers.
- Update `reconcileInspectionStatuses`: in `awaiting_parts`, only transition to `awaiting_repair` when every approved issue has BOTH `parts_ordered = true` AND `parts_arrived = true`.
- Update `checkAllPartsArrived` (or add `checkAllPartsReady`) to require both flags.

**Types (`src/types/inspection.ts`)**: add the new fields to `InspectionIssue`.

**UI (`src/pages/BicycleInspections.tsx` — Awaiting Parts tab)**:
- For each approved issue show two checkboxes side-by-side: "Parts ordered" and "Parts arrived" (admin/mechanic only).
- "Parts arrived" stays disabled until "Parts ordered" is checked.
- "Move to Awaiting Repair" / auto-transition fires only when all approved issues have both checked.

### Out of scope
- Customer-facing surfaces — they don't show parts state, no change needed.
- Pricing flow — already implemented in previous turn.

## Technical details
- Migration adds 4 nullable/defaulted columns — safe for existing rows (default `parts_ordered=false`, but existing inspections already past awaiting_parts won't be re-evaluated because reconcile only looks at `awaiting_parts` status).
- For any inspection currently in `awaiting_parts` with parts already arrived, admin will need to tick "parts ordered" once. Acceptable given small dataset; alternatively backfill `parts_ordered = parts_arrived` in the migration — recommend backfilling to avoid stuck rows.
