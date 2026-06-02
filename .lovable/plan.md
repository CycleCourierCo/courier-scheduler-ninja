
# Inspections Analytics Section

## Scope
Add a new "Inspections" tab to `src/pages/AnalyticsPage.tsx` with four metrics:
1. Inspections over time (line chart, monthly)
2. % of inspections with at least one issue
3. Average cost to repair (avg total approved-issue cost per inspection with issues)
4. % of inspection issues approved (approved / responded)

## Changes

### 1. `src/services/inspectionAnalyticsService.ts` (new)
- `fetchInspectionsForAnalytics()` — paginated fetch of `bicycle_inspections` joined with `inspection_issues(*)`, bypassing the 1000-row limit.
- `getInspectionsOverTime(inspections)` → `{ month, count }[]` grouped by `created_at` month.
- `getInspectionsWithIssuesRate(inspections)` → `{ withIssues, withoutIssues, percentage }`.
- `getAverageRepairCost(inspections)` → average summed `estimated_cost` across approved/resolved/repaired issues, per inspection that had issues. Returns `{ average, sampleSize }`.
- `getIssueApprovalRate(inspections)` → of issues with a customer response (approved/declined/resolved/repaired), the % treated as approved (approved/resolved/repaired). Returns `{ approved, declined, percentage }`.

### 2. `src/components/analytics/InspectionsOverTimeChart.tsx` (new)
Recharts `LineChart` showing inspections per month, styled to match `OrderTimeChart`.

### 3. `src/pages/AnalyticsPage.tsx`
- Add `inspections` tab trigger (with a `ClipboardCheck` or `Wrench` icon) and a 6th grid column on `TabsList`.
- New `TabsContent value="inspections"` with:
  - Three `StatsCard`s: % with issues, avg repair cost (£), % issues approved.
  - `InspectionsOverTimeChart` below.
- New `useQuery({ queryKey: ['inspectionsAnalytics'], queryFn: fetchInspectionsForAnalytics })`.

## Out of scope
- No DB, RLS, or backend changes (existing admin RLS on `bicycle_inspections` / `inspection_issues` allows the queries from this admin-only page).
- No changes to inspection workflow code.
