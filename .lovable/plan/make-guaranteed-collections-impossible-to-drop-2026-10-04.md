# Make guaranteed collections impossible to drop

## What's happening
I checked the 15:28 run for Monday 5th. Only 4 vans were used (KU17DDH, DF66UZB, KV18WHR, AV66UTH), with about 220 jobs available. Only 64 jobs fit, so every van was full.

The Poole collection is top priority, but the planner adds up the importance of every job on a van. Going to Poole and back takes about 6 hours. In that time a van could do several local jobs, and together those jobs outweigh the one Poole job. So Poole loses. Letting any van take it, as in the last change, didn't help, because the problem is time, not direction.

## Fix
1. **Guaranteed jobs are placed first.** Any job that must go today for a guarantee is put on a van before the normal plan runs:
   - guaranteed deliveries on their date
   - collections on the last day that still makes the guarantee
2. **Choosing the van.** Each van is tried with the guaranteed job on it. The planner keeps the one that loses the fewest other jobs.
3. **Everything else after.** The rest of the work is then planned around it, and the guaranteed job stays on its van.
4. **When it truly can't fit,** for example when even the long-day van can't reach it in 15 hours, At-risk gives the real reason: "Needs about X more hours than any van has — add a van or book a courier".
5. **Van warning.** When the number of jobs is more than about 3 times what the ticked vans can carry, a note appears at the top of that day's results. For example: "Only 4 vans ticked for 220 jobs — guaranteed and last-date jobs may push others off."

## Technical
- route-optimize, per day: collect `forcedLegs` (guaranteedDate === date, or forGuarantee && lastDate === date). For each one, test-solve every assignment with the job as a forced vehicle `steps` entry (VROOM `steps: [{type:'start'},{type:'job',id},{type:'end'}]`). Pick the van with the lowest lost priority. Then run the full solve with that forced step kept.
- If no van can take it, add `forced_infeasible` with the hours shortfall to the at-risk reason.
- Add `capacity_note` to the day debug and show it in GenerateRoutesDialog.
- Deploy route-optimize. Check read-only that the Poole job appears in the next run (I won't run the planner myself).
