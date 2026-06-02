## Goal

In the **Bicycle Inspections** page, while an inspection is in the `awaiting_pricing` stage, allow admins/mechanics to fully edit each issue (description + part info + price), as well as add new issues and remove existing ones — not just set the price.

Today, the "pricing" stage only exposes a `£ Price` input + Save button per issue. Description, part name/spec/number are read-only and there's no add/remove control.

## Changes

### 1. `src/services/inspectionService.ts` — add three service functions

- `updateInspectionIssue(issueId, fields)` — updates `issue_description`, `estimated_cost`, `part_name`, `part_spec`, `part_number` on an existing row. When `estimated_cost` is provided, also stamp `priced_at` / `priced_by_id` / `priced_by_name` so the "all priced" gate still works.
- `deleteInspectionIssue(issueId)` — deletes the row from `inspection_issues`.
- `addIssueToExistingInspection(inspectionId, orderId, …)` — thin wrapper that inserts a new row directly against the existing inspection (so we don't re-trigger the status reset that `addInspectionIssue` does via `getOrCreateInspection`). Stamps `priced_*` if cost provided.

### 2. `src/pages/BicycleInspections.tsx` — pricing-stage UI

Inside the issue card block, gated by `isAdmin && isAwaitingPricing` (also allow `isMechanic` if that matches current part-edit permissions — confirm with existing pattern that mechanics already manage parts at this stage):

- Replace the current price-only row with an **inline editable form** per issue containing:
  - Description (textarea)
  - Estimated cost (£ number input)
  - Part name / spec / number (three inputs, mechanic+admin)
  - **Save** button → calls `updateInspectionIssue`
  - **Delete** button (destructive, with `AlertDialog` confirm) → calls `deleteInspectionIssue`
- Below the issue list, add an **"Add issue"** button that opens a small inline form (or reuses the existing add-issue dialog scoped to this inspection) and on submit calls `addIssueToExistingInspection`.
- Local state keyed by `issue.id` to track edited values; on successful mutation invalidate `["bicycle-inspections"]`.

### 3. New mutations in the same component

- `updateIssueMutation`, `deleteIssueMutation`, `addIssueAtPricingMutation` — mirror the existing `setPriceMutation` shape (toast on success/error, invalidate the inspections query).

### 4. No backend / RLS changes

`inspection_issues` already supports insert/update/delete for admin+mechanic via existing policies used by `addInspectionIssue` / `setIssuePrice`. No migration needed; if the delete call fails for RLS we'll add a policy then.

## Out of scope

- No changes to the customer-facing flow (issues only become visible to customer after "Release to Customer").
- No changes to other stages (`awaiting_parts`, `awaiting_repair`, `issues_found`).
- No email/notification changes.
