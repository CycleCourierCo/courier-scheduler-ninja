# Prioritise older and nearly-out-of-time jobs, and pack routes fully

## What changes

**1. Real priority order between jobs**

Today the planner only knows two levels: "must go today" and "everything else" — a three-week-old job with two dates left counts exactly the same as a fresh one with six. That's why the wrong jobs get left behind.

New ranking, highest first:

- Jobs that must go today (guaranteed date is today, today is the customer's last date, or an expired job when the override is on) — unchanged, top of the pile.
- Everything else gets a score built from two things:
  - **How few dates are left** — the strongest factor. One remaining date scores near the top, plenty of dates scores low.
  - **How old the job is** — days since the order was booked, and for a bike already in the depot, days it has been sitting there. Older wins.

So when the van can only fit one of two nearby jobs, it takes the older one, and the one closer to running out of dates beats the one with a week of slack.

**2. Stop asking how many jobs a route should carry**

The "Jobs per route (target)" and "Flag routes below" boxes go. The planner packs each van until either the van is full of bike spaces or the shift hours run out — nothing else. A van is still only taken off the day if every job it carried still gets done without it, so no work is dropped to tidy the fleet up.

Thin-route badges stay, but as plain information ("only 6 stops — nothing else fitted nearby"), not as a target to hit.

**3. Remove "Firm days" and "Inspection lead days"**

Both boxes come off the Generate Routes window. Every selected day is planned as a firm day, and deliveries waiting on an inspection are never auto-unlocked (the current behaviour when the lead-days box is left blank).

## Technical notes

- `supabase/functions/route-optimize/index.ts`
  - `Leg` gains `ageDays` (from `orders.created_at`) and `depotDays` (days since collection for delivery legs); both populated in `considerLeg`.
  - New `legPriority(leg, date)`: `100` for `mustGo`; otherwise `clamp(30 + scarcity + age, 1, 99)` where scarcity is derived from `futureDates.length` (fewest dates → largest bonus, weighted roughly 2:1 over age) and age from `max(ageDays, depotDays)` capped so it can never outrank scarcity or a must-go job. Used in `buildJob`.
  - Drop `min_jobs_target` / `min_jobs_floor` inputs, `DEFAULT_TARGET_JOBS`, `DEFAULT_FLOOR_JOBS`, `targetJobs`, `floorJobs`. Van-reduction (3.5) selects its candidate purely by fewest stops (and `minMargin` when set) and keeps the existing no-job-lost guard. The spare-van hint (3.6) triggers on leftovers rather than a stop count. `thin` / `below_floor` become derived flags off the day's median route size, for display only.
  - Drop `firm_days` and `inspection_lead_days` inputs: `provisional` is always false, `is_provisional` always false, and inspection-gated deliveries stay locked (the `null` lead-days path).
  - `route_plans.debug` loses `target_jobs` / `floor_jobs`, gains the priority inputs per leg for auditing.
- `src/services/routeGenerationService.ts`: remove `firm_days`, `inspection_lead_days`, `min_jobs_target`, `min_jobs_floor` from `GenerateRoutesInput`; `firm_days` off `RoutePlanResult`.
- `src/components/scheduling/generate/GenerateRoutesDialog.tsx`: remove the four inputs and their state; keep date picker, shift start, long-day cap, margin cut-off and the van grid. Any UI reading `firm_days` for provisional badges is removed.
- Deploy `route-optimize`; run the Deno check and the frontend typecheck.
