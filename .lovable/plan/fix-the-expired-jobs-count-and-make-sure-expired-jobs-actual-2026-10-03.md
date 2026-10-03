# Fix the expired-jobs count and make sure expired jobs actually reach the optimiser

## What's wrong (confirmed from live data)

**The 71.** Before you press Generate, the button counts every saved "expired" note in the database, and nothing ever clears those notes. Of the 71:
- 34 + 2 are orders that are already **delivered**
- 6 are **cancelled**
- 7 are **Northern Ireland** jobs
- several are collection legs where the bike has **already been collected**

Only **21 legs** are really open, plannable and out of dates (4 collections, 17 deliveries), which is close to the 23 on the Expiring Dates page. The small gap comes from a timezone difference and is fixed below.

**What the optimiser receives.** EASBS9 (delivery, bike in depot) and CHRM11 (collection) both qualify, and the optimiser does put them into every day's work with top priority when the expired switch is on. Two weak spots remain:
1. A leg the customer has since given **new future dates** keeps its old "expired" note. It's then treated and counted as expired, and dropped completely when the switch is off, even though it has valid dates.
2. The run doesn't record whether expired jobs were included or how many were placed. That's why we can't tell after the event why the Bristol route left them out. (The switch used to default to off, which is the likely cause.)

## Changes

1. **Honest count before a run.** The button will count only legs that are actually expired right now:
   - the order is still open (not delivered, cancelled, on hold or awaiting approval)
   - it's not a Northern Ireland job
   - that leg still needs doing: a collection not yet collected or booked, or a delivery not yet delivered or booked, and not Box My Bike
   - the customer gave dates and every date has passed, judged in London time

   Never-gave-dates and missed-guarantee jobs stay out of the count, as before.
2. **Same rule inside the optimiser.** "Expired" will be decided from the customer's actual dates, not the old saved note. A leg with fresh future dates is planned normally on those dates, and its stale note is reset to active.
3. **Clear out stale notes.** The nightly and "Re-check customer dates" check will also reset notes for delivered or cancelled orders, finished legs, and legs that have new dates. That stops the database count drifting again.
4. **Proof the expired jobs were planned.** Each run will record whether expired jobs were included and, for each day, how many expired jobs were offered and how many were placed. The results will show "X of Y expired jobs planned". Any expired job left out will still appear in the at-risk list with its reason.

## What stays the same
- Expired jobs are still included by default, and you can switch them off per run.
- Their priority, the van limits and the London rules don't change.

## Technical details
- `fetchLapsedLegs` (routeGenerationService.ts): select the needed order fields (status, ni_direction, order_collected, scheduled_pickup_date, order_delivered, scheduled_delivery_date, is_box_my_bike, pickup_date, delivery_date, guaranteed_delivery_date). Apply the same eligibility and "every date before London today" test, and set `date_state` to match.
- route-optimize `considerLeg`: `expired = dates.length > 0 && future.length === 0`. Treat `legStatus !== 'active'` as expired only when there are no future dates. When future dates exist and the stored status isn't active, upsert it back to `active`. Set `lapsed = expired`. Use London "today" for the comparison if it isn't already.
- route-optimize debug: add `include_expired`, plus `lapsed_in_pool` and `lapsed_placed` per day. Return a top-level `lapsed_offered` and `lapsed_placed` for the dialog's results line.
- expire-availability: reset to active, or delete, rows whose order is delivered or cancelled, whose leg is finished or booked, or whose dates now include a future date.
- Deploy route-optimize and expire-availability. Running a full plan to test would replace your active plan, so checking is done with read-only database counts. You'll do the signed-in check.
