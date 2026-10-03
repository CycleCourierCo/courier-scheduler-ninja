# Stop old locked routes from hiding expired jobs

## Problem
The latest Generate Routes run (Sun 4 Oct) offered only 7 expired jobs and placed 6. At least 8 more genuinely expired jobs (LAWOX3, DANNW3, OLIDE6, ANTHR4, JIMEN6, CHRSA7, TOMCF6, MICDT2) never reached the planner because they sit on locked routes from September that were never completed. The optimiser treats a job on ANY locked route as reserved — even when that route's date is in the past — so these jobs are excluded from every future run.

## Changes

### 1. Only future/today locked routes reserve a job (`route-optimize` edge function)
- When loading locked legs, filter to routes whose date is today or later (or within the selected dates). A locked route from a past date no longer blocks the job from being planned again.
- The "bike collected on a locked day is in the depot" logic keeps working for today/future locked routes only.

### 2. Surface stale locked routes instead of hiding them
- Locked routes whose date has passed and whose jobs were not completed are flagged in the run results (at-risk / warnings list) so staff can see "this job was locked for 28 Sept and never done" rather than it vanishing.
- The Expiring Dates / at-risk output already lists missed must-go jobs; these stale-locked jobs will now appear there with the reason.

### 3. Data check
- Report how many locked routes exist with past dates (read-only count) so you can decide whether to bulk-release them to draft. No automatic unlocking of past routes in this change — they just stop blocking new plans.

## Out of scope
- No change to how locking works for today/future dates.
- No auto-deletion of old route plans.

## Verification
- Read-only SQL: confirm the 8 named expired jobs enter the pool after the fix (via the run's lapsed_offered count on the next Generate — you press the button).
- Build check; route-optimize redeployed.
