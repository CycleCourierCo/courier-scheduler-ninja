# Proactive emails: scheduled jobs take priority

## Goal

Once a collection or delivery has actually been booked in, the proactive update for that side should be the booking confirmation only — never a generic "your bike is safely with us" or "we're planning your route" message. Plus notify the other side when a leg is booked.

## Rules to implement

1. Collection booked (future pickup date, not yet collected):
   - Sender: "Your collection is booked for <date>" (existing).
   - Receiver: "Collection booked for <date>" (existing) — keep.
   - Suppress the sender "we're planning your collection / building your route" message.
2. Delivery booked (future delivery date, not yet delivered):
   - Receiver: "Your delivery is booked for <date>" (existing).
   - Sender: NEW — "The bike you sent is booked for delivery on <date>", short reassurance that it's the final leg and nothing to do.
   - Suppress the receiver "your bike is safely with us / depot / workshop" message and the sender "your bike is on its way to the buyer" message for that side.
3. One update per side per run, chosen by explicit priority rather than push order, so a booked leg always beats the in-depot/awaiting-route messages:
   delays > booking confirmations > awaiting availability > awaiting route > with-us/workshop.

## Technical notes

- All changes are in `supabase/functions/send-order-updates/index.ts` (`deriveUpdates`).
- Give each `Update` a numeric priority and, before sending, keep only the highest-priority update per side. This removes the reliance on push ordering and on the current implicit guards (`!scheduled_delivery_date` on the with-us block, `!scheduled_pickup_date` on the route block), which stay in place as belt-and-braces.
- Sender delivery-booked stage key: `delivery_scheduled_sender`, so the 2-day quiet window and `order_update_log` dedupe work as they do today.
- Box My Bike, Foam My Bike / Northern Ireland branches keep their current early returns and are unaffected.
- Before changing behaviour, check `order_update_log` for recent `in_depot*` / `sender_dates_received` / `sender_bike_on_way` rows on orders that already had a scheduled date, to confirm which path actually fired and that the fix targets it.

## Out of scope

Timeslot emails the day before, and status-change transactional emails — unchanged.
