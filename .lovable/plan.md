## Workshop Schedule view on Bicycle Inspections

Add a new **Schedule** tab (admin/mechanic) on `src/pages/BicycleInspections.tsx` that shows every outstanding workshop job and packs them into a projected day-by-day plan based on labour minutes.

### What counts as a job

Each card in the backlog represents one bike's outstanding workshop work:

- **Needs inspection** — `orders.needs_inspection = true` and no `bicycle_inspections` row (or status `pending`). Estimated time: **10 min** (fixed, no DB storage needed for now).
- **Ready to repair** — inspection has approved issues where every approved issue has `parts_arrived = true` OR the issue has no `part_name`/`part_number` (parts not required). Estimated time: sum of `labour_minutes` from the linked `labour_times` rows for those issues (fallback: `labour_cost / rate × 60` when no `repair_id`).
- **Waiting on parts** — approved issues exist but at least one has `parts_arrived = false`. Same labour-minute total, shown in a separate "Blocked — awaiting parts" lane (not scheduled into days).
- **Cleaning-only** — no priced issues but cleaning tasks (`frame_cleaned_at` / `drivetrain_degreased_at`) still pending. Fixed 10 min.

Statuses `inspected`, `repaired`, and orders with no outstanding cleaning are excluded.

### Priority & scheduling rules

- Sort all schedulable jobs by `orders.created_at` ascending (oldest first).
- Daily capacity = single value from `workshop_settings.daily_capacity_minutes` (new column, default 480).
- Pack greedily: fill day 1 up to capacity, spill to day 2, etc. Skip weekends (Sat/Sun) by default; skip dates already in `holidays` table.
- Awaiting-parts jobs are NOT scheduled — they sit in a "Blocked" column with the age and what part is outstanding.

### UI

New tab "Schedule" on the existing Tabs strip. Layout:

```text
┌─ Capacity: [480] min/day  (admin editable, saved to workshop_settings) ────┐
│                                                                            │
│  BACKLOG                          │  PROJECTED PLAN                        │
│  ─────────────────────────────    │  ──────────────────────────────────    │
│  Ready to work (12) ▾             │  Mon 27 Jul  ▓▓▓▓▓▓▓▓░░ 380/480 min    │
│   • Trek Domane · 45 min · 12d    │    - Trek Domane (repair, 45m)         │
│   • Giant Defy   · 20 min · 9d    │    - Giant Defy (repair, 20m)          │
│  Awaiting parts (4) ▾             │    - Cannondale (inspect, 10m)         │
│   • Cannondale · 60m · part: RD   │    ...                                 │
│  Needs inspection (7) ▾           │  Tue 28 Jul  ▓▓▓░░░░░░░ 150/480 min    │
│   • ...                           │    ...                                 │
└────────────────────────────────────────────────────────────────────────────┘
```

- Each backlog card: bike (brand/model), tracking #, age (`formatDistanceToNowStrict`), estimated minutes, small badge for category (Inspect / Repair / Cleaning / Parts), quick "Open" link to the existing inspection dialog.
- Each planned-day card shows a capacity bar and the packed jobs in order, click-through opens the same inspection dialog.
- Empty state per lane.
- Mobile: stacks vertically (backlog first, then plan), reusing the mobile patterns already in this page.

### Files

- **New migration**: add `daily_capacity_minutes int not null default 480` to `workshop_settings`.
- **New service**: `src/services/workshopScheduleService.ts` — one query that pulls open inspections + issues + orders, joins `labour_times.labour_minutes` by `repair_id`, and returns `{ readyJobs, awaitingPartsJobs, needsInspectionJobs }` with `{ orderId, inspectionId, label, ageDays, minutes, kind }`.
- **New component**: `src/components/inspections/WorkshopScheduleTab.tsx` — renders backlog + projected plan; uses `useWorkshopSettings()` for capacity and holidays via existing `holidayService`.
- **`src/pages/BicycleInspections.tsx`**: add the new `TabsTrigger`/`TabsContent`.
- No changes to existing inspection dialog/flow.

### Technical notes

- Pure client-side packing — no scheduling state persisted. Recomputed on load / when data invalidates.
- Reuses `labourPricing.ts` fallback (`labour_cost × 60 / hourly_rate`) so historical issues with no `repair_id` still get minutes.
- Mechanic role sees the same view but the capacity input is disabled (admin-only), matching how the Labour Times page already gates workshop settings.
- No changes to `inspection_issues` schema or existing UI paths.