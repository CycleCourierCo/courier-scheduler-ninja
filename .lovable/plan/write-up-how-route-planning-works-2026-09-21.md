# Write up how route planning works

Something in the plans has gone wrong, and the planner has grown a lot of rules
that interact with each other. Before changing anything else, I'll write a single
document that explains, step by step, exactly what happens when you press
Generate — so we can both point at the rule that's misbehaving.

## What I'll produce

A new file `docs/ROUTE_PLANNING.md`, written in plain language with the exact
numbers and settings named, covering:

1. **What you choose on screen** — days, shift start, which vans on which days,
   include-expired toggle, max long days, balanced vs daily planning.
2. **Which jobs are eligible** — collections still to collect, deliveries whose
   bike is in, what's excluded (Northern Ireland, ferry, already-planned/locked
   jobs, missing coordinates), and how a job's available dates are read.
3. **Date states** — waiting on first dates, expired, expiring during the plan,
   guaranteed date, and what each one does to eligibility and priority.
4. **Priority** — how the number is built (guaranteed, scarcity of dates, days
   left, job age, expiry boosts) and what it actually means to the optimiser.
5. **Vans** — which vehicle statuses are offered, capacity in bike spaces,
   12h / 15h caps, long-day (expedition) allowance and cost premium, virtual
   "extra van" vans, and the new per-area allocation.
6. **Money model** — what a van costs per shift, per hour and per mile, and how
   that drives whether the optimiser opens another van or drives further.
7. **Geography rules** — how the country is split into areas around the depot,
   how vans are matched to areas, the spread limit per route, and what happens
   to stops trimmed for being too far out.
8. **The run itself** — main solve, repair re-solves, collect-and-deliver pairs,
   grace pass for expiring jobs, time budget, and what is skipped when time runs
   out.
9. **What comes back** — routes, stops and ETAs, leftover/at-risk groups,
   day summaries and costings, and the shortfall ("short by n vans") figures.
10. **After generating** — locking a route, the handoff into Get Timeslots, and
    what Get Timeslots recalculates rather than trusting.
11. **Known rough edges** — a short honest list of the places most likely to be
    causing what you're seeing now, each with where in the flow it sits.

## Technical notes

The document is compiled from the current code, not from memory:
`supabase/functions/route-optimize/index.ts`, `route-shortfall`,
`route-validate`, `expire-availability`, `src/services/routeGenerationService.ts`,
`src/components/scheduling/generate/*` and `src/lib/routeCosts.ts`. Every
constant quoted (12h, 15h, £11/hour, £0.45/mile, 120/220-mile spread, 15-minute
stops, 2 long days) will be checked against the source as I write, and any
mismatch between code and intent is listed in section 11 rather than glossed
over.

No code changes in this step — documentation only.
