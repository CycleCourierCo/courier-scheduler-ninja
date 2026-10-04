# Last job before 8:30pm

## What changes
- Generate Routes: no van's last stop can start after 20:30 (London time). The van can still drive back to the depot afterwards.
- Jobs that only fit by finishing later are left off and shown in At-risk as "Would arrive after 8:30pm".
- Long-day (difficult-area) vans follow the same 20:30 rule.
- Get Timeslots: if a stop's time comes out after 20:30 (for example after adding jobs by hand), it shows a red "After 8:30pm" warning. Nothing is removed automatically there.
- Front-loaded routes: vans start their first job as early as possible with no waiting gaps early in the day, and the stops are packed into the start of the shift so the last job finishes as early as it can. Where there's a choice, the long drive home comes at the end rather than long drives between stops in the middle.

## Technical notes
- `supabase/functions/route-optimize/index.ts` `buildJob`: clip every job's time window end to `londonEpoch(date, '20:30')` (drop the job from that date if the clipped window is empty). Vehicle `time_window` stays as is, so the return drive is allowed after 20:30. Same clip in reorder/split modes.
- New at-risk reason when a leg's only feasible windows end before arrival.
- Front-loading: add a cost on time spent before the last task (VROOM `costs.per_task_hour`, guarded fallback if Verso rejects it) so earlier finishes are cheaper; treat waiting time as cost; in reorder mode the same costing applies. Report each route's last-stop time on the card.
- `RouteBuilder.tsx` timeslot list: badge on stops whose ETA is after 20:30.
- Redeploy `route-optimize`.
