# Prioritise soon-to-expire jobs in Generate Routes

## Goal

When planning several days (e.g. Mon–Wed), jobs whose last customer date falls inside that window are currently treated like any other job: they can only go on their own dates, get no special priority, and if their date is full they simply appear in the at-risk list and lapse overnight. Only already-lapsed jobs can be pulled in via the "Include expired jobs" override.

This change makes the planner actively protect jobs at risk of expiring:

1. **Expiring jobs are prioritised** so they get planned before fresher work.
2. **Grace spillover** — if an expiring job can't fit on its own last date, it may be planned on a later day within the same plan window (e.g. the Tuesday job can land on Wednesday if Tuesday is full), and the stop is clearly badged as planned after its dates ran out.
3. **Visibility** — day summaries show how many jobs expire on each day, and the at-risk panel shows each job's last date so nothing lapses silently.

Already-expired jobs keep working exactly as today (include-expired override, lapsed counts).

## Behaviour in detail

- A job counts as **expiring in this plan** when it still has future dates, is not lapsed, and its *last* available date falls on or before the last day being planned.
- Expiring jobs get a priority bump on top of the existing scarcity scoring (few remaining dates already raises priority), so the optimiser prefers them over fresher multi-date work.
- After the main solve, any expiring job that didn't fit gets one extra "grace" attempt: it may use any later day in the plan window. Placed stops that used a grace day are flagged `planned after its dates` in the route output.
- Grace solves run for both Balanced and Day-by-day modes, after the normal flow and before the plan is saved.
- Jobs expiring *after* the plan window (e.g. expiring Friday when planning Mon–Wed) are untouched — normal priority, no spillover.

## Technical changes

**`supabase/functions/route-optimize/index.ts`** (deploy after edit)

- Add an `expiringInPlan` flag on `Leg`: not lapsed, has future dates, and `max(future dates) <= last selected date`.
- In `buildPriority` / leg creation: add a capped boost (≈ +15, still capped at 99) for `expiringInPlan` legs.
- Add a **grace pass** after the existing joint/greedy flow: take expiring legs that are unassigned, extend their `windowDates` to all selected dates on/after their last real date, and re-solve with the unassigned pool against van-days whose remaining capacity is reduced by what's already planned. Merge any newly placed legs into `current`, marking them.
- Response additions:
  - Per-day: `expiring_count` (legs whose last date is that day) and `expiring_unplanned_count` (of those, not placed anywhere).
  - Whole plan: `expiring_in_plan_count`.
  - Stops placed via the grace pass: `planned_after_expiry: true` in the route JSON.
  - `at_risk` entries gain `last_date`.

**`src/services/routeGenerationService.ts`**

- Extend `AtRiskLeg` with `last_date?: string`; add the new per-day and whole-plan fields and the stop flag to the response types.

**`src/components/scheduling/generate/DaySummary.tsx`**

- New stat "Expiring this day" showing the count, with a sub-line for how many of those weren't placed (only shown when > 0). Whole-plan totals row uses the plan-wide count.

**`src/components/scheduling/generate/GenerateRoutesDialog.tsx`**

- At-risk panel: show the last date ("expires 23 Sep") when `last_date` is present.
- Route stop rows: small warning badge on stops flagged `planned_after_expiry`.

## Verification

- TypeScript check passes.
- Redeploy `route-optimize`; confirm an authenticated generation with mixed date sets returns the new per-day expiring counts and grace placements, and unauthenticated calls still get 401.
