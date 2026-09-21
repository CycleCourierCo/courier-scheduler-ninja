# Keep the London van on London work

## Why the route looks like that

The London fence only works one way. London jobs are marked so that *only* the
London van can take them — but the London van itself is not restricted, so it is
free to pick up ordinary work anywhere. The planner sees a van already out with
time left, so it adds Oxford, Winchester, Brighton and Milton Keynes to the same
day. That is the red route in the screenshot.

## The change

1. **Fence the London van too.** The van set aside for London may only take
   London jobs, plus jobs that genuinely sit on the way in or out.
2. **"On the way" is a corridor, not a free-for-all.** A non-London job qualifies
   only if it lies within about 12 miles of the straight line between the depot
   and the middle of the drawn London area, and sits between the depot and
   London rather than beyond it. Brighton, Winchester and the south coast fail
   that test; a job just off the M1/M40 on the way down passes.
3. **Everything else is unchanged.** Non-London vans keep one open pool of work,
   drawn areas still only affect the one longer day, and any leftover London work
   still triggers the second London van.

## Technical detail

In `supabase/functions/route-optimize/index.ts`:

- Restore `CORRIDOR_MI = 12` and a perpendicular-distance helper from the leg to
  the depot → London-centroid segment, with the projection clamped to roughly
  5%-100% of the segment so jobs beyond London don't qualify.
- Add `LONDON_ONLY_SKILL`. London legs and corridor-eligible legs carry it;
  all other legs also carry a `GENERAL_SKILL`.
- Give London vehicles `[DIFFICULT_SKILL, LONDON_ONLY_SKILL]` only — no
  `GENERAL_SKILL`, so they cannot take off-corridor work. All other vehicles
  carry `GENERAL_SKILL` (and `LONDON_ONLY_SKILL` for corridor legs) but never
  `DIFFICULT_SKILL`.
- Count corridor legs in `dayDebug` so the at-risk panel still explains anything
  that could not be placed.
- `deno check`, then deploy `route-optimize`.
