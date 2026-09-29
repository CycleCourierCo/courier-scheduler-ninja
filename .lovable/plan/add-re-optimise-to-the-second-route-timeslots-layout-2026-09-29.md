# Add Re-optimise to the second Route Timeslots layout

The Route Builder has two versions of the Route Timeslots popup (one for smaller screens, one for wide screens). The Re-optimise button was only added to the wide-screen version, so it is missing from the one in your screenshot.

## Change
- In the smaller-screen Route Timeslots layout, add the **Re-optimise** button (lightning icon) between **Recalculate** and **Flip Route**, matching the other buttons' size.
- Same behaviour as the existing one: greyed out under 3 jobs, shows "Optimising..." while running, Undo afterwards.

## Technical details
- `src/components/scheduling/RouteBuilder.tsx` ~line 3867: insert a Button using `handleReoptimise`, `isReoptimising`, `Zap`/`Loader2`, disabled when `selectedJobs.filter(j => j.type !== 'break').length < 3 || isReoptimising`, classes `flex-1 h-8 text-xs`.
