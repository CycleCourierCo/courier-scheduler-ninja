# Switch: prioritise older jobs, or not

## What it does

A new toggle in the Generate Routes window: **Favour older jobs** (on by default).

- **On** — a job's importance comes from how few dates it has left *and* how long it has been waiting (days since booking, or days the bike has sat in the depot). Older work wins when two nearby jobs compete for the same space.
- **Off** — only how few dates are left counts. Waiting time is ignored, so a fresh job and a three-week-old job with the same dates left are treated the same.

Jobs that must go today stay top of the pile either way, and packing still runs until the van's bike spaces or the shift hours run out.

The setting is remembered for the session and shown in the run details so it's clear which way a plan was made.

## Technical notes

- `route-optimize`: read `prioritise_age` from the body (default `true`). `legPriority` keeps `100` for must-go; the age term (`min(20, round(waiting / 1.5))`) is added only when the flag is on, scarcity term unchanged. Include `prioritise_age` in `route_plans.debug` settings.
- `routeGenerationService.ts`: add `prioritise_age?: boolean` to `GenerateRoutesInput`.
- `GenerateRoutesDialog.tsx`: add a `Switch` next to the existing "include expired" control, state defaulting to `true`, and pass it through `planInput`.
- Deploy `route-optimize`; run `deno check` and the frontend typecheck.
