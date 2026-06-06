## Goal
On the Analytics page → Inspections tab, show the average (and median) time taken for each stage of the inspection workflow, so you can see where bikes are getting stuck.

## Stages tracked

| # | Stage | From timestamp | To timestamp |
|---|-------|----------------|--------------|
| 1 | Collected → Inspection | `orders.order_collected` true (use most recent collection tracking event, or fall back to `scheduled_pickup_date`) | `bicycle_inspections.inspected_at` |
| 2 | Inspection → Pricing | `bicycle_inspections.inspected_at` | `inspection_issues.priced_at` (earliest per inspection) |
| 3 | Pricing → Issues sent to customer | `inspection_issues.priced_at` | `inspection_issues.customer_responded_at` (earliest approved) |
| 4 | Issues → Waiting for parts | `inspection_issues.customer_responded_at` (approved) | `inspection_issues.parts_ordered_at` |
| 5 | Waiting for parts → Awaiting repair | `inspection_issues.parts_ordered_at` | `inspection_issues.parts_arrived_at` |
| 6 | Awaiting repair → Repaired | `inspection_issues.parts_arrived_at` (or `customer_responded_at` if no parts needed) | `inspection_issues.resolved_at` (status `repaired`/`resolved`) |

Inspections / issues missing the relevant timestamps are skipped for that stage only (so each stage has its own sample size).

## Implementation

**`src/services/inspectionAnalyticsService.ts`**
- Extend `InspectionAnalyticsRecord` to also pull `inspected_at`, plus order collection info (`orders.order_collected`, `tracking_events`, `scheduled_pickup_date`) via the existing inspections query (join `orders!inner(...)`).
- Extend `inspection_issues` selection with `priced_at`, `parts_ordered_at`, `parts_arrived_at`, `resolved_at`, `customer_responded_at`, `customer_response`, `status`.
- Add `getInspectionStageDurations(inspections)` that returns an array:
  ```ts
  { stage: string; avgHours: number; medianHours: number; sampleSize: number }[]
  ```
  one row per stage above. Helper to convert ms → hours, compute mean + median, ignore negatives/nulls.

**`src/components/analytics/InspectionStageDurationsChart.tsx`** (new)
- Horizontal bar chart (Recharts) using the existing `ChartContainer` pattern, one bar per stage showing average hours, tooltip showing median + sample size. Uses semantic tokens (`hsl(var(--primary))` etc.) — no hard-coded colors.

**`src/pages/AnalyticsPage.tsx`**
- In the Inspections tab, below the existing `InspectionsOverTimeChart`, render the new `InspectionStageDurationsChart` plus a small summary `StatsCard` for end-to-end average (collected → repaired).

## Out of scope
No DB migrations, no edge function changes, no changes to the inspection workflow itself — purely a read-only analytics view over existing timestamps.
