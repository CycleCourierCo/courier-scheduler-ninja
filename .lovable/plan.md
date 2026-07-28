## Current behaviour (verified)

`supabase/functions/shipday-webhook/index.ts` treats every completed delivery the same:

- sets `status = "delivered"`, `order_collected = true`, `order_delivered = true`
- fires the delivery-confirmation email

There is no reference to `is_northern_ireland`, `foam_status` or `delivered_to_ferry` anywhere in `supabase/functions/` — those are only set manually from the Foam My Bike UI. So a completed City Air Express drop currently marks a NI order fully delivered, skipping the ferry stage.

## Proposed change

In the Shipday webhook, when the completed leg is the **delivery** leg and the order is flagged Northern Ireland:

1. Set `status = "delivered_to_ferry"` instead of `delivered`.
2. Set `order_collected = true` but leave `order_delivered = false` — the bike hasn't reached the customer yet.
3. Set `foam_status = "delivered_to_ferry"` so the Foam My Bike board moves the card automatically.
4. Record the tracking event with the description "Delivered to Port — awaiting transport across the Irish Sea".
5. Skip the standard delivery-confirmation email; the final "delivered" email stays with the manual mark-as-delivered action in the Foam My Bike section.

Same branch applied in `supabase/functions/reconcile-shipday-orders/index.ts` so the reconcile backfill doesn't undo it.

## Technical detail

- The webhook's order lookup needs `is_northern_ireland` and `foam_status` added to its `select`.
- Branch placed where `newStatus` is resolved for the delivery leg (both the status-mapped path and the proof-upload path around lines 223 and 260), so either route produces the ferry status.
- Non-NI orders are untouched.

## Open question

If you'd rather the customer still gets an email at the ferry stage (a "your bike has reached our Irish Sea carrier" note), say so and I'll add a dedicated template instead of suppressing the email.