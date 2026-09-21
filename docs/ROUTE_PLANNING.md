# How Generate Routes works

This is the whole route planner written out in order, exactly as the code
behaves today. Every number quoted here was read out of the code while writing
this, so it can be used to argue with the planner when it does something odd.

The planner lives in three places:

- the Generate Routes popup on Job Scheduling (what you choose),
- the `route-optimize` job on the server (all the rules and the solving),
- Verso's hosted VROOM optimiser (the actual maths of ordering stops).

Nothing else is allowed to talk to Verso, and the Verso key never leaves the
server.

---

## 1. What you choose on screen

| Control | Default | Limits | What it does |
|---|---|---|---|
| Days | next working days | 2 to 10 days | The only days work may be placed on. |
| Shift start | 09:00 | any time | When every van leaves the depot. |
| Vans per day | all in-use/off-road vans | — | Tick grid: which vans exist on which day. |
| Firm days | 2 | 0 to number of days | Days beyond this are labelled "provisional". |
| Inspection lead days | blank (never) | 0 to 14 | Days a bike needing inspection must sit before delivery. Blank means inspection jobs are never delivered inside the plan. |
| Max long days per day | 1 | 0 to 4 | How many 15-hour long-day vans may exist on one day. |
| Jobs per route (target) | 13 | 1 to 30 | Vans are taken off the road until every route carries at least this much work. |
| Fewest jobs allowed | 9 | 1 to target | Below this a route is flagged red for a dispatcher to decide on. |
| Include expired jobs | off | — | Lets jobs whose customer dates have all passed be planned anyway. |
| Balanced / Daily tab | Balanced | — | Balanced solves all days together; Daily fills each day in turn. |

Two separate plans are kept: one Balanced, one Daily. Generating replaces the
previous plan of that kind only.

---

## 2. Which jobs are eligible

Every live order is read (anything cancelled or delivered is skipped), and each
order can offer two pieces of work: a collection and a delivery.

Excluded outright:

- Northern Ireland and ferry work (handled manually).
- Orders on hold or waiting for approval.
- Box My Bike deliveries.
- Anything already on a locked or confirmed day in an existing plan.
- A collection that is already booked in (it keeps its booked day).
- A delivery that is already booked in.
- Anything without map coordinates on the address.
- A date that falls on a non-working day is ignored, even if it is stored on the
  order.

A delivery can only be placed if its bike will be with us: either it is already
in the depot, or its collection is planned earlier in the same run, or its
collection is already booked in before the plan starts. If the order needs an
inspection, the delivery also has to wait the inspection lead days — and if that
box is blank, the delivery is not planned at all.

---

## 3. Date states

Each leg carries one of these states, worked out against today's London date:

- **Waiting on first dates** — the customer has never given dates. Can never be
  planned; appears under "Waiting on first dates".
- **Expired** — dates were given and all of them are in the past. Normally
  excluded; with "Include expired jobs" on, such a job may be placed on *any* of
  your chosen days.
- **Expiring inside the plan** — its last remaining date falls within the days
  you picked. Still normal work, but prioritised and given a second chance (see
  the grace pass).
- **Guaranteed date** — a promised delivery date. It is pinned to that exact day
  at top priority, and if that day isn't in your selection the job is simply not
  offered. If the guaranteed day is already past, it is listed as "Guaranteed
  date missed".

Whenever a leg is found to have lapsed, that is written back to the order's
availability record, so nothing lapses silently.

---

## 4. Priority

Each job gets a number from 1 to 99, except guaranteed dates which are 100.

```text
priority = 60 / (number of future dates offered)
         + 40 / (days until the LAST of those dates)
         + boosts
```

Boosts:

- **+10** if it is being planned through the expired override.
- **+10** if its last date falls inside this plan.
- **+1 per full week since the order was booked, capped at +5.**
- plus any manual boost stored on the leg, capped at +20.

The last date is used, not the nearest, so a job available every day for a month
does not pretend to be urgent.

Priority only decides what gets dropped when there isn't room. Fleet size and
geography are handled by their own rules below, not by priority.

---

## 5. Vans

- Only vans with status **in use** or **off road** are offered. Anything in
  repair, awaiting sale, sold or written off never appears.
- A van's capacity is its own bike-space figure, or the workshop default (10).
  A bike's size comes from the bike-type space table, so a tandem eats more
  space than a road bike.
- Vans you untick, and vans marked unavailable on a date, are dropped for that
  date.
- **Normal shift: 13 hours**, depot to depot. All travel times are padded by 5%
  so the plan survives re-timing. There is no separate driving cap.
- **Long day: 15 hours.** Worked out per difficult area, not from all difficult
  work lumped together, because one van cannot do Cornwall and Carlisle. Areas
  are ranked by the work waiting in them, and a long day is created only for the
  top areas that hold at least 5 jobs, or work that would otherwise be lost —
  never more than your "Max long days" setting.
- **Fleet size is decided outside the optimiser.** The optimiser will always
  send another van out if it places one more job, so after solving the thinnest
  route's van is taken off the road and the day is solved again. This repeats
  (up to 8 times) until every route carries the target amount of work. A removal
  is undone if it would push out a guaranteed job, or a job with no date left
  after this plan — that van-day is then kept and its route labelled
  **"Thin — needed for urgent jobs"**, listing the jobs that justify it.
- Every stop takes **15 minutes**.
- **Extra vans** (2 per day) are imaginary vans used only to answer "you were
  short by n vans", and only count when they would carry a proper day's work or
  rescue urgent work. They are never saved into a plan.

---

## 6. The money model

The optimiser is given real money, in whole pence, so that "open another van"
and "drive further" are judged on the same scale:

- Driver time: **£11 per hour** (1100p).
- Distance: **£0.45 per mile** (28p per km).
- Putting a van on the road: a flat charge of **2 hours' pay** (2200p).
- A long day costs **1.5×** on both the shift charge and the hourly rate.

Distance costing is never dropped quietly. If the optimiser rejects it the run
fails with a clear message, and the plan shows a red banner rather than handing
back sprawling time-only routes.

The same £11/hour and £0.45/mile are used for the costings shown on the day
summary and in Get Timeslots, so the figures agree.

---

## 7. Geography rules

- The country is divided into the area **around the depot** (within 45 miles),
  where any van may work, and **16 compass areas** of 22.5° out from it.
- Vans are **not** pre-allocated to single areas. Instead each day is split into
  **area groups of three neighbouring areas**, chosen where the work actually
  is: the busiest area and its two neighbours, then the next busiest of what's
  left, and so on. A group is only created if it holds at least the "fewest jobs
  allowed" figure, or there is a van spare for it.
- One van covers each group. Vans left over after that **roam** (any area); the
  fleet-reduction rule above takes them off the road if they end up thin.
- Work in an area that got no group that day is not sent for that day. If a job
  gets no group on any day in the plan it appears in the at-risk list as "Area
  too quiet this week — no viable route" — unless it is guaranteed or expiring,
  in which case a van is widened to take it.
- A collection and its delivery are only tied to the same van when they are
  within **30 miles** of each other. Otherwise the collection goes out on its
  own and the delivery is planned on a later day of the plan.
- If a route's two furthest stops end up more than **120 miles apart** (**220**
  on a long day), its most outlying stop is removed and the plan is **solved
  again** (up to 3 times), so the gap gets filled with nearby work and the job
  can still go on another day.
- Each route card shows its area and how far apart its stops are.
- Separately, five **difficult areas** are held as map shapes (Cornwall & Devon,
  Margate/East Kent, Carlisle & Lakes, Northumberland, Pembrokeshire). Stops
  inside them are flagged, each area has its own long-day van, and a long day
  covers one difficult area only.
- Ordinary jobs get a **13-hour** window; jobs in a difficult area get 15 hours,
  because only long-day vans can reach them.

---

## 7a. Run details and skipped steps

Every run records how it was worked out — vans offered and used per day, jobs
per route, van-days removed or kept, area groups, long days, solver calls and
time, stops dropped for sprawl. Admins can open **Run details** in the popup to
compare one run with another; it is also saved with the plan.

If time runs out, steps are dropped from the end of this list first: main solve,
deliveries pass, van reduction, spread trimming, grace pass. Anything skipped
shows as a yellow banner on the plan, so a partial plan is never presented as a
finished one.

---

## 8. What happens when you press Generate

**Balanced:**

1. **Main solve** — all days, all vans, all ready work, in one go. Collections
   and deliveries that can happen on the same day are sent as a linked pair, so
   a van can empty out and load again.
2. **One repair re-solve** — only if a van somehow ended up with both a normal
   and a long route on the same day.
3. **Deliveries pass** — collections placed in step 1 are pinned to their day,
   and the deliveries they unlock are added and solved again. If pinning a
   collection then pushes it out, this pass is discarded.
4. **Grace pass** — jobs about to expire that still didn't fit get one more try
   on a later day inside the plan, using whatever room is left on each van.
   These stops are marked "planned after expiry".
5. **Save and return.**

**Daily:** each day in turn is filled as full as it will go before the next day
is looked at, with no per-van shift charge so every van is offered. Work placed
on an earlier day is gone by the time the next day is planned.

**Time budget:** the run has 90 seconds. Optional steps (repair re-solve,
deliveries pass, grace pass) are skipped once the budget is nearly gone, so a
plan is always saved rather than the run being killed.

**"Short by n vans"** is worked out by a completely separate second call after
the plan is on screen, so it can never break Generate.

---

## 9. What comes back

Per route: van, area, stop spread in miles, stop count, hours, miles, peak load
against capacity, guaranteed jobs, whether it is a real long day, and the drawn
route line.

Per day: vans used out of vans available, spare vans, provisional or firm,
leftover job counts (split into ordinary and expired), jobs expiring that day,
guaranteed dates that could not be met, and the "an extra van would plan n more
jobs" figures.

Plus two lists:

- **At risk** — everything not placed, worst first, each with a reason ("waiting
  on its collection being planned", "no feasible slot on the days you picked",
  "guaranteed date could not be met", and so on).
- **Needs new dates** — split into *guaranteed date missed*, *dates expired*,
  and *waiting on first dates*, each with a button to ask the customer again.

---

## 10. After generating

Locking a day fixes its routes, which takes those jobs out of any future
generation. "Use this route" opens Get Timeslots in a new tab with that day,
shift start, van and stop order already loaded.

Get Timeslots stays the source of truth for customer times: it re-times the
route itself from live driving times, rather than trusting the planner's ETAs.
The planner's times are an estimate for judging whether a day fits.

---

## 11. Known rough edges

These are the places most likely to explain a plan that looks wrong:

1. **Area allocation can starve a region.** Vans are shared out by how much work
   each area has *before* solving. If an area gets fewer vans than its work
   needs, the surplus can't spill onto a van assigned elsewhere — it lands in
   the leftover list instead. This is the most likely cause of a sudden jump in
   unplanned jobs.
2. **Spread trimming silently shortens routes.** Stops cut for being too far out
   are removed after the solve, so a route's hours and miles still describe the
   longer version it was solved as. Counts are right; time and mileage are
   slightly pessimistic.
3. **Collect-and-deliver pairs can cross areas.** A pair whose two ends sit in
   different areas is given no area restriction at all, so it can still stretch
   a route — spread trimming is the only thing holding it back.
4. **Long days are all-or-nothing per area.** A difficult-area job can only go on
   a long-day van. With "Max long days" at 0, those jobs cannot be planned at
   all and go straight to the leftover list.
5. **Job windows are generous.** A job's own time window is drawn against a
   15-hour day even on a 12-hour van, so the van's shift is the only thing
   keeping late stops out.
6. **Daily mode can't look ahead.** Filling Monday fully may leave nothing
   sensible for Tuesday in that direction.
7. **Nothing outside your chosen days is considered.** A job whose only dates
   fall after the horizon is neither planned nor flagged — it simply isn't in
   the run.
8. **Distance pricing depends on Verso.** If the endpoint rejects a per-mile
   cost, the run quietly retries without it, and that solve reverts to
   time-only costing — which is what produced the sprawling routes before.
