# Add "Collected → Repaired" to Inspection Stage Durations

Add a seventh bar to the Inspection Stage Durations chart on the Analytics page showing the total time from the bike being collected to all repairs being finished.

## Change

- `src/services/inspectionAnalyticsService.ts` — in `getInspectionStageDurations`:
  - Add a `collected_to_repaired` bucket.
  - Per inspection: `diffHours(collectedAt, lastResolved)` where `collectedAt` is the existing collection timestamp (tracking event or scheduled pickup) and `lastResolved` is the latest `resolved_at` across its issues.
  - Label: "Collected → Repaired". Only counted for inspections that have both a collection time and at least one resolved issue.
- No chart component change needed — the bar chart renders whatever stages the service returns.

## Notes

- This is an end-to-end measure, so it will naturally be the longest bar; it sits alongside the existing per-stage bars.
- Inspections with no issues (nothing to repair) are excluded, same as the other repair-stage bars.
