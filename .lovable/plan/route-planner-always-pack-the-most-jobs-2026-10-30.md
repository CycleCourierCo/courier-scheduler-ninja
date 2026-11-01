# Route planner: always pack the most jobs

## What it does today
- There is no 13-job cap. Each van is filled until its bike spaces or shift hours run out (13 hours depot to depot, 15 for a long London day, last job by 20:30).
- "13" shows up in three places, none of them a hard cap:
  1. **Thin route warning** – routes under 13 stops get a "thin" badge in Generate Routes. Display only.
  2. **13-hour shift limit** – the normal working-day limit.
  3. **London van guess** – the planner guesses how many vans London needs as roughly 13 jobs per van (max 2 vans). This is the only part that can leave jobs off: if London has more work than the guess allows, the extra London jobs are dropped even when another van has room.

## Change
1. Stop using "13 jobs per van" to decide London vans. Start with the smallest number of vans that fits by bike spaces. If London jobs are still left off and there is a free van, add one more London van (still max 2) and solve again. Keep whichever plan covers more jobs.
2. Add a final "squeeze" step: try each dropped job on every route for that day and add it wherever it still fits within hours, bike spaces and time windows.
3. Keep the thin-route badge as a warning only, and add a per-day "jobs left off and why" line (out of hours / van full / no van for London) so you can see the reason.

## Not changing
- Hour limits, bike-space limits, guaranteed/last-date priority, the London 2-van fence and the rule that one van always stays for the rest of the country.

## Technical details
- `supabase/functions/route-optimize/index.ts`: replace `LONDON_JOBS_PER_VAN` in `allocate` with a capacity-based start plus a retry when London legs are unassigned; add an insertion pass over VROOM `unassigned` legs per day; return the reason in `dayDebug`.
- Vitest test: a London day with 20 jobs that fit in two vans by hours and spaces must not drop any.
