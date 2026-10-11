# Mechanic Clock: show each day's work, time per job, and clock-out explanation

## What you'll see

On the Mechanic Clock page, each day's timeslip will list the work that mechanic did that day:

- **Inspections** — bikes inspected, with bike name and tracking number.
- **Repairs** — each repair marked done, with description and bike/order.
- **Box My Bike** — bikes they boxed that day.
- **Foam My Bike** — bikes they foamed that day.

Each item shows the time it was done and how long it took:

- **Repairs**: the standard time from the labour-times list for that repair (e.g. "Brake pads — 30 min").
- **Inspections, boxing, foaming**: a standard assumed time each (e.g. inspection 45 min, box 20 min, foam 15 min — exact numbers confirmed with you before building, stored as editable constants).

Each day then shows a **total**: recorded work time vs clocked hours, and the difference (e.g. "Clocked 7.5h — work recorded 5h — difference 2.5h").

## Clock-out explanation

- When a mechanic taps **clock out** and the difference between clocked hours and recorded work time is more than 30 minutes, a popup asks them to explain what else they were doing (free text, required — they cannot clock out without filling it in).
- The explanation is saved on the timeslip and shown to admins/timeslip admins on the timeslips page next to that day.
- If the difference is under 30 minutes, clock-out works as today with no popup.

## How it works (technical)

- Page: `src/pages/MechanicClock.tsx`.
- Data (all existing tables, scoped to the signed-in mechanic):
  - `bicycle_inspections` where `inspected_by_id = user`, `inspected_at` on that date.
  - `inspection_issues` where `resolved_by_id = user`, `resolved_at` on that date.
  - `orders` where `box_boxed_by_id = user`, `box_boxed_at` on that date; same for `foam_foamed_by_id` / `foam_foamed_at`.
  - Repair standard times from `labour_times` (matched by repair name; falls back to a default if no match).
- One small database migration: add `clock_out_explanation text` (nullable) to `mechanic_timeslips`. No RLS changes — existing policies already cover the mechanic and admins.
- Clock-out flow: after photo + location, compute the day's totals; if difference > 30 min, show the explanation dialog, then save with the explanation.
- Admin view: `MechanicTimeslipsTab.tsx` shows the explanation (and the work summary) on each slip.

## Notes and assumptions

- Actual start/finish times per job are not recorded anywhere today, so "time taken" uses standard/expected minutes per task — this is an estimate, not a stopwatch. If you want true per-job timing later, mechanics would need start/finish buttons per job (separate piece of work).
- Standard times for inspection/box/foam will be confirmed with you before building.
- Days with no recorded work show "No work recorded" and will always trigger the explanation popup if clocked in.
- No changes to pay calculation or approvals.
