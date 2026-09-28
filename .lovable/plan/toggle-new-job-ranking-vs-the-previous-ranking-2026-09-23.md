# Toggle: new job ranking vs the previous ranking

## What it does

A new toggle in the Generate Routes window: **Favour older jobs** (on by default), switching between two ranking styles:

- **On (new ranking)** — a job's importance comes from how few dates it has left *and* how long it has been waiting (days since booking, or days the bike has sat in the depot). Older, nearly-out-of-dates work wins when two nearby jobs compete for space.
- **Off (previous ranking)** — the planner behaves as it did before the last change: every ordinary job is marked equally important (`50`), with no regard to age or how many dates are left.

Either way, jobs that must go today (guaranteed today, last customer date today, or expired with the override on) stay at the top (`100`), and packing still runs until the van's bike spaces or the shift hours run out.

The run details record which ranking was used, so it's clear how a plan was made.

## Technical notes

- `route-optimize`: read `prioritise_age` from the body (default `true`). `legPriority` returns `100` for must-go; when the flag is off it returns `50` (the previous behaviour); when on, the current `clamp(30 + scarcity + age, 1, 99)` formula. All uses (job build, at-risk sorting, debug) follow the flag. Record `prioritise_age` in `route_plans.debug` settings.
- `routeGenerationService.ts`: add `prioritise_age?: boolean` to `GenerateRoutesInput`.
- `GenerateRoutesDialog.tsx`: add a `Switch` next to the "include expired" control, state defaulting to `true`, passed through `planInput`.
- Deploy `route-optimize`; run `deno check` and the frontend typecheck.
