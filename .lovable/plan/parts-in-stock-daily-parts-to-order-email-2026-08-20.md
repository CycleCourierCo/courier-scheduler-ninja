# Parts in stock + daily parts-to-order email

## 1. "Part in stock" tick when recording an issue

Wherever a part spec is entered on an inspection issue, add an **In stock** checkbox:

- Inspection checklist issue rows (multi-issue reporting)
- "Add issue" form at the pricing stage (and post-approval extras)
- Admin edit-issue form (so a mistake can be corrected later)

Behaviour when ticked:
- The issue is recorded as needing no ordering — it counts as parts ordered *and* arrived from the moment it is approved.
- Once every approved issue on a bike is either in stock or has its parts arrived, the inspection moves straight to **Awaiting repair** instead of sitting in **Awaiting parts** (this uses the existing status sync, so it also applies immediately on approval).
- The issue shows an "In stock" badge instead of the Order parts / Parts arrived buttons.

Untick reverses it: the issue goes back to needing ordering and the bike returns to Awaiting parts if it hasn't been repaired yet.

## 2. Daily 2pm "parts to order" email

New internal report emailed to Info@cyclecourierco.com every day at 14:00 London time, listing parts we still need to buy:

- Included: approved issues where a part is named/spec'd, **not** marked in stock, and **not** yet marked ordered.
- Grouped by bike (tracking number, brand/model, customer, storage bay, days waiting), with part name, spec, part number and the repair.
- Also a short section for parts already ordered but not yet arrived, so chasing is easy.
- If nothing needs ordering, sends a one-line "nothing to order today" email so the absence of an email never looks like a failure.

## Technical notes

- Migration: add `parts_in_stock boolean not null default false` (+ `parts_in_stock_at`, `parts_in_stock_by_id`, `parts_in_stock_by_name`) to `public.inspection_issues`. No new table, so existing grants/RLS apply.
- `src/services/inspectionService.ts`: accept `parts_in_stock` in `addInspectionIssue` / `addIssueToExistingInspection` / issue update; treat `parts_in_stock` as satisfying the "parts ready" condition in `syncInspectionStatuses` and in `issueReadyForRepair`; add `setIssuePartsInStock(issueId, inStock, byId, byName)`.
- `src/types/inspection.ts`: extend `InspectionIssue`.
- `src/pages/BicycleInspections.tsx`: add `partsInStock` to `IssueEntry`, `newIssueDraft`, `editIssueDraft`; checkbox next to the part spec field in all three forms; badge + toggle on the issue row (admin/mechanic only).
- `src/services/workshopScheduleService.ts`: select `parts_in_stock` and treat it as arrived so Workshop Schedule stops showing these bikes as awaiting parts.
- `supabase/functions/send-internal-reports/`: add `parts-to-order` to `REPORTS` and a `buildPartsToOrderReport` in `reports.ts` reusing the existing HTML helpers and Resend sender.
- Cron: schedule `invoke_internal_report('parts-to-order')` at `0 13 * * *` (14:00 BST) via a direct insert (not a migration), matching the existing report cron pattern.
