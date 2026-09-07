# Missing collection card for CCC754621940862RUATN2

## What the data shows

Both orders are inbound Northern Ireland, at ferry stage "crossed ferry", and both already have a Shipday collection and delivery reference. The difference is the collection date:

- `CCC754621940862RUATN2` — collection already booked for 2 September (in the past), never completed, still not collected.
- `CCC754872802020GORCV3` — collection booked for 8 September (tomorrow).

The job planner only lists a leg while it has no booked date (`scheduled_pickup_date` empty). Once a collection is booked it disappears from the planner, whether or not it ever happened. So RUATN2's Manchester ferry collection dropped off the list on 2 September and only its delivery remains visible — nothing is wrong with the Shipday reference or the ferry stage.

## Fix: booked-but-overdue collections must come back into view

- A collection whose booked date has passed and which is still not marked collected reappears in the planner, tagged as overdue with the date it was booked for, so it can be re-sequenced onto a new day. Same rule for deliveries booked in the past that never completed.
- Re-booking such a job overwrites the old date rather than creating a second stop.
- Inbound ferry collections keep the "Ferry hand-off" tag and the Manchester hand-off address on that card.
- The existing "expired dates only" toggle keeps its current meaning (customer availability), so the new overdue behaviour is not hidden behind it.

## Verify

- RUATN2 shows a collection card again, tagged overdue, at the Manchester hand-off address, alongside its delivery card.
- GORCV3 is unchanged.
- Booking RUATN2's collection onto a new day updates the single stop, and it drops out of the overdue list once completed.

## Technical notes

- `src/components/scheduling/RouteBuilder.tsx` lines 1415 and 1443: replace `!order.scheduled_pickup_date` / `!order.scheduled_delivery_date` with "unbooked OR (booked date before today AND leg not completed)", using `order_collected` / `order_delivered` as the completion test and Europe/London day boundaries.
- Mirror the same predicate in `src/pages/JobScheduling.tsx` (`hasUnscheduledPickup` / `hasUnscheduledDelivery`) so the map and the list agree.
- Overdue badge rendered on the job card next to the existing Shipday/ferry badges; no schema change and no backend change.
