## Goal

Extend the bicycle inspection workflow with three changes:

1. Mechanics capture part name / spec / number when reporting issues (hidden from customers).
2. After a mechanic submits issues, an admin reviews and prices each issue before the customer sees anything.
3. "In Repair" is split into two stages: **Awaiting Parts** (per-issue parts-arrived tracking) → **Awaiting Repair** (current "mark repaired" flow).

## New workflow

```text
Awaiting Inspection
        │  (mechanic completes inspection, attaches issues with part info)
        ▼
Awaiting Pricing        ← NEW. admin only. customer sees nothing yet.
        │  (admin sets price per issue, clicks "Release to Customer")
        ▼
Issues Found            ← customer sees issues + prices, approves/declines
        │  (all issues responded; ≥1 approved)
        ▼
Awaiting Parts          ← NEW. mechanic marks each approved issue "parts arrived"
        │  (all approved issues have parts arrived)
        ▼
Awaiting Repair         ← renamed from "In Repair". mechanic marks each repaired
        │
        ▼
Repaired
```

If every issue is declined, skip parts/repair → goes straight to Repaired (as today).

## Database changes

`bicycle_inspections.status` (text, unchecked) — add new values used by app:
- `awaiting_pricing`
- `awaiting_parts`
- `awaiting_repair` (replaces `in_repair` going forward; existing `in_repair` rows backfilled to `awaiting_repair`)

Add columns:
- `bicycle_inspections.released_to_customer_at timestamptz` — set when admin completes pricing & releases.
- `bicycle_inspections.released_by_id uuid` / `released_by_name text`.

`inspection_issues` new columns:
- `part_name text`
- `part_spec text`
- `part_number text`
- `priced_at timestamptz`, `priced_by_id uuid`, `priced_by_name text`
- `parts_arrived boolean not null default false`
- `parts_arrived_at timestamptz`, `parts_arrived_by_id uuid`, `parts_arrived_by_name text`

Backfill:
- `bicycle_inspections` rows with `status = 'in_repair'` → `awaiting_repair`.
- Existing issues with non-null `estimated_cost` → set `priced_at = created_at` so they don't get stuck in pricing.
- Existing inspections already past inspection with no `released_to_customer_at` → set it to `inspected_at` so historical orders behave as before.

Update `get_public_inspection_summary` SQL function:
- Treat the inspection as "inspected" for the public timeline only when `released_to_customer_at IS NOT NULL` (use that as the `inspected_at` value the public sees). Pricing stage stays invisible to customers.
- Add `awaiting_parts_at` and `awaiting_repair_at` derived timestamps so the public tracking timeline can show the parts-arrived → repair transition. `repairs_completed_at` logic stays as-is (approved_count > 0 AND all approved are repaired).
- Never expose `part_name` / `part_spec` / `part_number` via this RPC.

## RLS

- `inspection_issues.part_name/spec/number` are columns on an existing table; RLS is row-level not column-level, so customer access is restricted via the existing select policy that already hides admin-only data from non-owners. Confirm the existing customer SELECT policy on `inspection_issues` does not need tightening — the public-facing customer view will be served exclusively through `get_public_inspection_summary` which omits these fields. Direct table access stays admin/mechanic-only as today.
- New write paths (admin sets price; mechanic marks parts arrived) use existing admin / mechanic role policies — no new policies needed beyond ensuring `parts_arrived*` and `priced_*` are writable by the right roles in the existing update policies.

## Frontend changes

### `src/types/inspection.ts`
- Extend `InspectionStatus` union with `awaiting_pricing | awaiting_parts | awaiting_repair`. Keep `in_repair` typed as deprecated for back-compat reads.
- Add new fields to `InspectionIssue` (part info, parts_arrived\*, priced\*) and to `BicycleInspection` (released_to_customer_at, released_by\*).

### `src/services/inspectionService.ts`
- `addInspectionIssue` accepts optional `part_name`, `part_spec`, `part_number`.
- After mechanic finishes adding issues, transition inspection to `awaiting_pricing` instead of `issues_found`.
- New `setIssuePrice(issueId, price)` — admin only; updates `estimated_cost`, `priced_at/by_*`.
- New `releaseInspectionToCustomer(inspectionId)` — admin only; requires every issue to have a price; sets `released_to_customer_at`, `released_by_*`, status → `issues_found`. This is the point that triggers the existing customer notification email (re-use whatever path currently fires when issues become visible).
- `reconcileInspectionStatuses` updated:
  - `awaiting_pricing` rows: untouched (manual admin gate).
  - `issues_found` with all issues responded → `awaiting_parts` (if ≥1 approved) or `repaired` (if all declined).
  - `awaiting_parts` with all approved issues having `parts_arrived = true` → `awaiting_repair`.
  - `awaiting_repair` with all approved issues `repaired` → `repaired`.
- `markPartsArrived(issueId)` / `unmarkPartsArrived(issueId)` — mechanic + admin.
- `checkAllApprovedRepaired` / `checkAndMoveToInRepair` updated to use the new statuses.

### `src/pages/BicycleInspections.tsx`
- Add Part name / Part spec / Part number inputs to the "Add issue" dialog (visible to admin + mechanic only — the page is already role-gated). Display part info in the admin issue list. Hide in any customer-facing rendering.
- New "Awaiting Pricing" tab/section showing inspections in that status. Each issue gets a price input + save; once all issues priced, a "Release to customer" button becomes enabled.
- Rename "In Repair" tab to two tabs: "Awaiting Parts" and "Awaiting Repair", filtered by the new statuses.
- In Awaiting Parts: each approved issue gets a "Parts arrived" toggle. Shows progress (e.g. 2/3 parts arrived). When toggling the last one, auto-call reconcile (or rely on the existing on-page reconcile call).
- In Awaiting Repair: existing "Mark repaired" UI.

### `src/pages/CustomerOrderDetail.tsx` and customer-facing inspection views
- Hide part name/spec/number fields.
- Treat `awaiting_pricing` as "still being inspected" (no issues shown yet) — same UI as `pending`/`inspected` with no issues.
- Show the new awaiting-parts / awaiting-repair phases on the timeline once the inspection is in repair.

### `src/components/order-detail/TrackingTimeline.tsx`
- Add timeline entries: "Awaiting Parts" (from `awaiting_parts_at` returned by the RPC) and rename the existing "Repairs Approved" → repair step to use the new awaiting_repair timestamp where appropriate. Keep "Repairs Completed" gated on `repairs_completed_at`.

## Out of scope

- Mechanic role permissions / route guards (already in place).
- Inspection invoice generation — keeps using `estimated_cost`; no change beyond timing (prices now exist before customer approves, same as today's flow).
- Email/WhatsApp template wording for the new release-to-customer step — re-using the existing "issues found" notification; copy tweaks can come in a follow-up.

## Verification

- Existing in-progress orders: rows backfilled cleanly (no inspections stuck on `in_repair` or unpriced).
- New order: mechanic adds 2 issues w/ part info → inspection sits in Awaiting Pricing, customer page still shows "Awaiting Inspection".
- Admin prices both, clicks Release → status flips to `issues_found`, customer notification fires, customer sees prices but no part info.
- Customer approves both → status → `awaiting_parts`. Mechanic toggles parts arrived for each → status → `awaiting_repair`. Mechanic marks both repaired → status → `repaired`. Public timeline reflects each step.
